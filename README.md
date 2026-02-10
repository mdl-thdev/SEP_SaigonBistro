# Saigon Bistro – Customer Support Help Desk System

Saigon Bistro is a full-stack, role-based Customer Support Help Desk System built to manage customer inquiries, order-related issues, and support tickets through a real-world workflow.

The application allows customers to submit and track support tickets, while staff and administrators can manage cases through a secure dashboard, assign ownership, respond to customers, update ticket status, and generate reports.

This project demonstrates API-driven workflows, authentication & authorization, and ticket lifecycle management in a production-style environment.

## Design Process

### Project Purpose

- Provide a centralized help desk for Saigon Bistro customers
- Allow authenticated users to submit, track, and reply to support tickets
- Enable staff and admins to manage ticket workflows
- Demonstrate real-world backend logic including permissions, state transitions, and data integrity
- Showcase a clean separation between frontend and REST APIs

### Target Users

- Customers can submit help requests, track ticket status, reply to staff within allowed time windows, leave feedback after resolution.
- Support Staff can riew assigned and unassigned tickets, claim tickets, communicate with customers, update ticket statuses.
- Administrators can view all tickets, assign or unassign tickets, manage staff, access reports and analytics.

### User Needs & Goals

- Customer: Simple ticket submission, visibility into progress, clear communication
- Staff: Efficient case handling, assignment control, clear status updates
- Admin: Oversight, assignment management, reporting and accountability

### Design Approach

- API-first architecture using Express.js
- Role-based access control (customer / staff / admin)
- Stateless authentication using Supabase JWTs
- Clear ticket lifecycle rules enforced on the backend
- Vanilla JavaScript frontend with modular structure
- Responsive UI using Tailwind CSS

### User Stories

- As a customer, I can submit a support ticket and receive a ticket number
- As a customer, I can view all my tickets and their statuses
- As a customer, I can reply to a ticket within 5 days of staff response
- As a customer, I can submit feedback once a ticket is resolved

- As staff, I can claim unassigned tickets
- As staff, I can reply to customers and update ticket status
- As admin, I can assign tickets to any staff member
- As admin, I can view reports summarizing ticket volume and trends

## Features

### Existing Features

- Feature 1: Secure Authentication & Role Management

Users authenticate securely using Supabase authentication.
Role-based access control for customers, staff, and administrators.

- Feature 2: Customer Support Ticket Submission

Customers can submit support tickets with category, subject, and description.
Each ticket is assigned a unique ticket number.

- Feature 3: Customer Ticket Tracking & Communication

Customers can view a list of their submitted tickets.
Customers can access full ticket history, including staff/admin replies.
Customers may reply to tickets within 5 days of the last staff/admin response.

- Feature 4: Automated Ticket Lifecycle Handling

Tickets are created with an initial New status.
Replying to a resolved ticket automatically reopens the case.
Ticket status transitions are enforced by backend business rules.

- Feature 5: Customer Feedback System

Customers can submit star-based feedback after a ticket is resolved.
Feedback can only be submitted once per ticket.

- Feature 6: Staff Ticket Management Dashboard

Staff can view all tickets with pagination and advanced filtering.
Staff can claim unassigned tickets and become the assigned owner.
Staff can reply to customers through the dashboard.

- Feature 7: Ticket Status Management

Staff and admins can update ticket statuses, including: New, In Progress, Waiting Customer Response, Resolved, Reopened.

- Feature 8: Admin Ticket & Staff Management

Admins can view all tickets and registered staff.
Admins can assign or unassign tickets to staff members.
Admins can override ticket ownership when required.

- Feature 9: Reporting & Analytics

Admins can view ticket reports and summaries.
Reports include: Tickets by status, Tickets by category, Time-range filtering for analysis.

### Features Left to Implement

- Email notifications for ticket updates and replies
- File attachments for support tickets
- Automated ticket escalation rules
- Exportable reports (CSV or PDF)
- Automated testing (unit and integration tests)
- Improved performance optimizations for large ticket datasets

##  Technologies Used

### Frontend

- **HTML5**  
  https://developer.mozilla.org/en-US/docs/Web/HTML
  Used for semantic structure and accessibility.

- **Tailwind CSS**  
  https://tailwindcss.com
  Utility-first CSS framework for responsive and consistent UI design.

- **Vanilla JavaScript**  
  https://developer.mozilla.org/en-US/docs/Web/JavaScript
  Handles UI logic, API communication, state management, and DOM updates.


### Backend

- **Node.js**  
  https://nodejs.org  
  JavaScript runtime for server-side logic.

- **Express.js**  
  https://expressjs.com  
  RESTful API framework handling routing, middleware, and request validation

- **Supabase Authentication**  
  https://supabase.com/docs/guides/auth  
  Supabase Authentication was used to handle user registration, secure password hashing, session management, and JWT-based authentication. All authentication logic is managed by Supabase, eliminating the need for manual password hashing or JWT handling in the application code.


## Testing

###  Cross-Browser & Responsive Testing

Manual testing was conducted throughout development to verify core functionality, user flows, and role-based access control.

The following areas were tested:

- Authentication flows, including login, logout, and role-based redirection
- Ticket lifecycle operations such as creation, replies, automatic reopening, and closure
- Role restrictions and permissions for customers, staff, and administrators
- Admin and staff dashboard functionality, including filtering, pagination, and reporting views
- Cross-browser compatibility on modern browsers (Chrome and Safari)
- Responsive layout behavior across desktop and tablet screen sizes

No critical layout or functional issues were observed during cross-browser testing.

### Bugs & Issues Identified

Backend cold start delay on Render free tier

### Testing Summary

All primary features were manually tested and verified to work as intended across supported user roles and browsers.
The system demonstrates stable behavior under normal usage conditions, with known performance limitations attributable to the hosting environment rather than application logic.

##  Credits

### Content
All written content and code were created by the author for educational purposes.

### Media
- Images in the project were sourced from royalty-free image platforms (e.g., Pexels). Some images were discovered via Google Search and verified for permitted usage where applicable.

### Acknowledgements
- Inspired by real-world customer support and help desk systems
- Guidance and structure informed by course materials and lectures
- Supabase and Render documentation used during deployment










