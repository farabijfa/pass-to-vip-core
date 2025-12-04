import type { Request, Response, NextFunction } from "express";
import { supabaseService } from "../services";
import { generate } from "short-uuid";

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: any },
  requestId?: string
) {
  return {
    success,
    data,
    error,
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
    },
  };
}

class CustomersController {
  async listCustomers(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.query;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      const sortBy = (req.query.sortBy as string) || "last_updated";
      const sortOrder = (req.query.sortOrder as string) === "asc" ? true : false;

      const client = supabaseService.getClient();

      let query = client
        .from("passes_master")
        .select(`
          id,
          external_id,
          passkit_internal_id,
          status,
          is_active,
          install_url,
          last_updated,
          users:user_id (
            id,
            email,
            first_name,
            last_name,
            phone_number,
            birth_date
          ),
          programs:program_id (
            id,
            name,
            passkit_program_id
          )
        `, { count: "exact" });

      if (programId) {
        const { data: program } = await client
          .from("programs")
          .select("id")
          .or(`id.eq.${programId},passkit_program_id.eq.${programId}`)
          .limit(1);
        
        if (program?.[0]) {
          query = query.eq("program_id", program[0].id);
        }
      }

      if (status) {
        query = query.eq("status", status.toUpperCase());
      }

      query = query
        .order(sortBy, { ascending: sortOrder })
        .range(offset, offset + limit - 1);

      const { data: customers, error, count } = await query;

      if (error) {
        console.error("List customers error:", error);
        return res.status(500).json(
          createResponse(
            false,
            undefined,
            {
              code: "DATABASE_ERROR",
              message: error.message,
            },
            requestId
          )
        );
      }

      const formattedCustomers = (customers || []).map((c: any) => {
        const user = Array.isArray(c.users) ? c.users[0] : c.users;
        const program = Array.isArray(c.programs) ? c.programs[0] : c.programs;
        
        return {
          id: c.id,
          externalId: c.external_id,
          passkitId: c.passkit_internal_id,
          status: c.status,
          isActive: c.is_active,
          installUrl: c.install_url,
          lastUpdated: c.last_updated,
          user: user ? {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            fullName: [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown",
            phoneNumber: user.phone_number,
            birthDate: user.birth_date,
          } : null,
          program: program ? {
            id: program.id,
            name: program.name,
            passkitProgramId: program.passkit_program_id,
          } : null,
        };
      });

      return res.status(200).json(
        createResponse(
          true,
          {
            customers: formattedCustomers,
            pagination: {
              total: count || 0,
              limit,
              offset,
              hasMore: (count || 0) > offset + limit,
            },
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("List customers error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }

  async getCustomer(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { customerId } = req.params;

      if (!customerId) {
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "INVALID_REQUEST",
              message: "Customer ID is required",
            },
            requestId
          )
        );
      }

      const client = supabaseService.getClient();

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId);

      let query = client
        .from("passes_master")
        .select(`
          id,
          external_id,
          passkit_internal_id,
          status,
          is_active,
          install_url,
          last_updated,
          users:user_id (
            id,
            email,
            first_name,
            last_name,
            phone_number,
            birth_date
          ),
          programs:program_id (
            id,
            name,
            passkit_program_id
          )
        `);

      if (isUuid) {
        query = query.eq("id", customerId);
      } else {
        query = query.or(`external_id.eq.${customerId},passkit_internal_id.eq.${customerId}`);
      }

      const { data: customer, error } = await query.limit(1);

      const c: any = customer?.[0];

      if (error || !c) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "CUSTOMER_NOT_FOUND",
              message: "Customer not found",
            },
            requestId
          )
        );
      }

      const { data: transactions } = await client
        .from("transactions")
        .select("id, action_type, value_change, notes, created_at")
        .eq("pass_id", c.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const user = Array.isArray(c.users) ? c.users[0] : c.users;
      const program = Array.isArray(c.programs) ? c.programs[0] : c.programs;

      return res.status(200).json(
        createResponse(
          true,
          {
            customer: {
              id: c.id,
              externalId: c.external_id,
              passkitId: c.passkit_internal_id,
              status: c.status,
              isActive: c.is_active,
              installUrl: c.install_url,
              lastUpdated: c.last_updated,
              user: user ? {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                fullName: [user.first_name, user.last_name].filter(Boolean).join(" ") || "Unknown",
                phoneNumber: user.phone_number,
                birthDate: user.birth_date,
              } : null,
              program: program ? {
                id: program.id,
                name: program.name,
                passkitProgramId: program.passkit_program_id,
              } : null,
            },
            recentTransactions: transactions || [],
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get customer error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }

  async getCustomerStats(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();

    try {
      const { programId } = req.query;
      const client = supabaseService.getClient();

      let programInternalId: string | null = null;

      if (programId) {
        const { data: program } = await client
          .from("programs")
          .select("id")
          .or(`id.eq.${programId},passkit_program_id.eq.${programId}`)
          .limit(1);
        
        programInternalId = program?.[0]?.id || null;
      }

      let query = client.from("passes_master").select("status", { count: "exact" });
      
      if (programInternalId) {
        query = query.eq("program_id", programInternalId);
      }

      const { data: allPasses, count: total } = await query;

      let installedQuery = client.from("passes_master").select("id", { count: "exact" }).eq("status", "INSTALLED");
      let uninstalledQuery = client.from("passes_master").select("id", { count: "exact" }).eq("status", "UNINSTALLED");

      if (programInternalId) {
        installedQuery = installedQuery.eq("program_id", programInternalId);
        uninstalledQuery = uninstalledQuery.eq("program_id", programInternalId);
      }

      const { count: installed } = await installedQuery;
      const { count: uninstalled } = await uninstalledQuery;

      return res.status(200).json(
        createResponse(
          true,
          {
            stats: {
              total: total || 0,
              installed: installed || 0,
              uninstalled: uninstalled || 0,
              activeRate: total ? Math.round(((installed || 0) / total) * 100) : 0,
            },
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get customer stats error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }
}

export const customersController = new CustomersController();
