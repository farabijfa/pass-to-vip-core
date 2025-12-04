# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem. It seamlessly integrates digital wallets with physical rewards processing, bridging physical interactions and digital loyalty programs. Key capabilities include comprehensive membership point management, one-time offer redemptions, dynamic digital pass creation and updates, and a "Physical Bridge" designed to convert physical mail recipients into active digital wallet users. The business vision is to provide a robust, scalable platform that enhances customer engagement through a unified loyalty experience across physical and digital touchpoints, unlocking significant market potential in retail, hospitality, and event management. The project aims to be the leading backend solution for phygital loyalty programs.

## User Preferences
I want iterative development.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations when new features or complex logic are introduced.
I do not want the agent to make changes to the /admin folder.

## System Architecture

### Core Design
- **Controllers:** Manage incoming API requests and delegate tasks to appropriate services.
- **Services:** Encapsulate business logic and handle integrations with external systems (Supabase, PassKit, PostGrid).
- **Logic Service:** Acts as the central orchestrator for Point-of-Sale (POS) actions, routing requests to Supabase RPC for data operations and PassKit for wallet synchronization.

### Data Flow
1. Client Request → Controller → `logic.service.ts`
2. `logic.service.ts` → Supabase RPC (executes stored procedures)
3. Supabase performs transactional database operations.
4. `logic.service.ts` → `passkit.service.ts` (triggers digital wallet updates if required).

### UI/UX Decisions
- **Admin Dashboard:** Features a Bootstrap-based UI for managing bulk campaigns, including drag-and-drop CSV upload, toggles for postcards/letters, configurable program IDs, templates, and real-time processing status.

### Technical Implementations
- **API Endpoints:** A comprehensive set of RESTful APIs for POS actions, loyalty operations, digital wallet management, direct mail, physical bridge, and high-scale notifications.
- **Supabase RPC:** Utilizes Supabase Remote Procedure Calls for secure and efficient execution of complex database logic, such as `process_membership_transaction`, `process_one_time_use`, `generate_claim_code`, `lookup_claim_code`, and `update_claim_code_status`.
- **Physical Bridge:** Implements a full "Phygital" loop where physical mail (postcards via PostGrid) with QR codes leads to digital wallet enrollment via a claim route (`/claim/:id`), integrating claim code generation, lookup, and PassKit enrollment.
- **Multi-Tenant SaaS:** Supports tenant provisioning through an admin API, allowing the creation of new tenants with associated Supabase Auth users, programs, and admin profiles, with automatic rollback on failure.
- **High-Scale Notification Service:** Designed for efficient broadcast and targeted notifications (e.g., birthday runs) using batch processing (50 users/batch) and parallel execution to manage PassKit rate limits, logging all campaigns.
- **QR Code Generation:** Automatically generates printable QR code image URLs using `api.qrserver.com` for integration into PostGrid templates.
- **Security:** Admin API endpoints are protected by API key authentication (`X-API-Key` header) and admin routes use Basic Auth.

### Feature Specifications
- **POS Actions:** Supports various action types including `MEMBER_EARN`, `MEMBER_REDEEM`, `COUPON_ISSUE`, and `COUPON_REDEEM`.
- **Digital Wallet:** Manages enrollment, coupon issuance, pass creation, updates, deletion, and push notifications through PassKit.
- **Direct Mail:** Integrates with PostGrid for sending postcards and letters, supporting various sizes and template variables.
- **Bulk Campaign Manager:** Facilitates batch campaigns via CSV upload, allowing for sending postcards or letters with dynamically generated claim codes.
- **Birthday Bot:** Automated process to identify members with birthdays, award points, and send personalized push notifications.

## External Dependencies

-   **Supabase:**
    -   **Database:** PostgreSQL database for storing all loyalty program data, member information, transactions, and claim codes.
    -   **Authentication:** Handles user authentication for tenants and admin users.
    -   **Edge Functions/RPC:** Executes stored procedures for core loyalty logic (`process_membership_transaction`, `generate_claim_code`, etc.).
-   **PassKit (via PassKit API):**
    -   **Digital Wallet Management:** Core service for creating, updating, and managing digital passes (memberships, coupons, event tickets).
    -   **Push Notifications:** Delivers real-time updates and messages to digital wallet holders.
    -   **Pass Install URLs:** Provides unique URLs for users to install digital passes.
-   **PostGrid (via PostGrid API):**
    -   **Direct Mail:** Used for sending physical postcards and letters as part of loyalty campaigns and the "Physical Bridge."
    -   **Template Management:** Utilizes PostGrid templates for dynamic content generation in physical mail.
-   **`api.qrserver.com`:**
    -   **QR Code Generation:** An external service used to convert claim URLs into QR code image URLs for printing on physical mail.