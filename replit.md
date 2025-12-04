# Phygital Loyalty Ecosystem - Backend API

## Overview
This project is a Node.js/Express backend API for a 'Phygital' Loyalty Ecosystem that integrates digital wallets with physical rewards processing. It aims to bridge physical interactions and digital loyalty programs through membership point management, one-time offer redemptions, dynamic digital pass creation and updates, and a "Physical Bridge" to convert physical mail recipients into digital wallet users. The platform seeks to enhance customer engagement across unified loyalty experiences in retail, hospitality, and event management.

## User Preferences
I want iterative development.
I prefer to be asked before you make any major changes to the codebase.
I prefer detailed explanations when new features or complex logic are introduced.
I do not want the agent to make changes to the /admin folder.

## System Architecture

### Core Design
- **Controllers:** Manage API requests and delegate to services.
- **Services:** Encapsulate business logic and handle integrations with external systems (Supabase, PassKit, PostGrid).
- **Logic Service:** Orchestrates Point-of-Sale (POS) actions, routing requests to Supabase RPC for data operations and PassKit for wallet synchronization.
- **Data Flow:** Client Request → Controller → `logic.service.ts` → Supabase RPC (for database operations) and `passkit.service.ts` (for digital wallet updates).

### UI/UX Decisions
- **Admin Dashboard:** Bootstrap-based UI for managing bulk campaigns, including CSV upload, configurable program IDs, templates, and real-time processing status.

### Technical Implementations
- **API Endpoints:** RESTful APIs for POS actions, loyalty, digital wallet management, direct mail, physical bridge, and high-scale notifications.
- **Supabase RPC:** Utilizes Supabase Remote Procedure Calls for secure execution of complex database logic.
- **Physical Bridge:** A full "Phygital" loop where physical mail with QR codes leads to digital wallet enrollment via a claim route.
- **Multi-Tenant SaaS:** Supports tenant provisioning through an admin API.
- **High-Scale Notification Service:** Designed for efficient broadcast and targeted notifications using batch processing and parallel execution to manage PassKit rate limits.
- **QR Code Generation:** Automatically generates printable QR code image URLs using `api.qrserver.com`.
- **Security:** Admin API endpoints are protected by API key authentication; admin routes use Basic Auth.

### Feature Specifications
- **POS Actions:** Supports `MEMBER_EARN`, `MEMBER_REDEEM`, `COUPON_ISSUE`, `COUPON_REDEEM`.
- **Digital Wallet:** Manages enrollment, coupon issuance, pass creation, updates, deletion, and push notifications via PassKit.
- **Direct Mail:** Integrates with PostGrid for sending postcards and letters.
- **Bulk Campaign Manager:** Facilitates batch campaigns via CSV upload, sending physical mail with dynamically generated claim codes.
- **Broadcast Notifications:** Sends push notifications to all active passes in a program.
- **Birthday Bot:** Configuration-driven automated process for awarding points and sending personalized push notifications on birthdays.
- **CSV Campaign Upload:** Supports `birth_date` and `phone_number` columns with flexible header mapping, automatically upserting users by email.

## External Dependencies

-   **Supabase:**
    -   **Database:** PostgreSQL for loyalty program data, member information, transactions, and claim codes.
    -   **Authentication:** Handles user authentication.
    -   **Edge Functions/RPC:** Executes stored procedures for core loyalty logic.
-   **PassKit (via PassKit API):**
    -   **Digital Wallet Management:** Creates, updates, and manages digital passes (memberships, coupons, event tickets).
    -   **Push Notifications:** Delivers real-time updates and messages to digital wallet holders.
-   **PostGrid (via PostGrid API):**
    -   **Direct Mail:** Sends physical postcards and letters for loyalty campaigns and the "Physical Bridge."
    -   **Template Management:** Uses PostGrid templates for dynamic content in physical mail.
-   **`api.qrserver.com`:**
    -   **QR Code Generation:** Converts claim URLs into QR code image URLs.