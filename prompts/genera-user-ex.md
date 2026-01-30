SDLC Documentation Analysis - Example User Queries

This document contains example user queries formatted for the SDLC Analysis Agent. Each example follows the structure:

Task Definition & Metadata: Defines the specific task and the relevant documentation context in a natural language sentence.

User Query: The detailed prompt from the user.

1. Traceability and Gap Analysis

Example 1
Perform a Traceability and Gap Analysis between the SRS and the Functional Specification.
Compare the "User Registration" section in the SRS with the Authentication Functional Specification. Are there any business requirements listed in the SRS that are missing implementation details in the Functional Spec?

Example 2
Perform a Traceability and Gap Analysis between the Business Requirements and the API Spec.
Trace the "High-Speed Transaction Processing" requirement from the Business Requirements Document to the Payment Gateway API Specification. Does the API spec explicitly address the latency constraints mentioned in the requirements?

Example 3
Perform a Traceability and Gap Analysis between the SRS and the Screen Spec.
Review the "Dashboard Widget" requirements in the SRS. Do the wireframes and descriptions in the Dashboard Screen Specification account for all the data points required by the business?

Example 4
Perform a Traceability and Gap Analysis between the Compliance Doc and the System Architecture.
Map the GDPR "Right to be Forgotten" requirement from the Compliance Document to the Data Retention Policy in the System Architecture Spec. Is there a gap in how data deletion is technically handled?

Example 5
Perform a Traceability and Gap Analysis between the SRS and the Functional Spec.
I need to verify coverage for the "Loyalty Tier Calculation" logic. detailed in the SRS. Please check the Loyalty Module Functional Specification and list any sub-requirements that have not been addressed.

2. Specification Understanding

Example 1
Analyze the API Specification for Specification Understanding.
Review the "Search API" documentation. The term "fuzzy matching" is used for the query parameter q. Can you clarify exactly what algorithm or matching threshold is defined for this, or identifying if it is ambiguous?

Example 2
Analyze the Functional Specification for Specification Understanding.
In the Notification Service Functional Spec, the system is described to send emails "immediately." Please interpret what "immediately" means in this technical context and identify if there is a specific SLA or measurable time limit defined.

Example 3
Analyze the Database Schema Spec for Specification Understanding.
Look at the "User_Status" field description in the Database Schema. Is the definition of the status 'Archived' clearly distinguished from 'Deleted', or is the terminology overlapping and unclear?

Example 4
Analyze the Screen Specification for Specification Understanding.
The Mobile App Screen Spec mentions "smooth transition" between the List and Detail views. Identify if this is a measurable animation specification or a non-measurable subjective term that needs clarification.

Example 5
Analyze the Security Protocol Spec for Specification Understanding.
Analyze the "Session Timeout" section in the Security Spec. Is the behavior for "User Activity" defined strictly (e.g., API calls vs mouse movement), or is the definition ambiguous?

3. Logic Extraction

Example 1
Extract Logic from the Functional Specification (Pricing).
Extract the business rules for calculating "Dynamic Shipping Costs" found in the Checkout Module Functional Specification. Please output the logic as a step-by-step algorithm.

**Example 2**
```
Extract Logic from the Workflow Specification.
What are the state transitions and triggers for the "Document Approval" lifecycle?
```

**Example 3**
```
Extract Logic regarding API Validation Rules.
What validation logic is defined for the POST /create-user endpoint in the User Management API Spec?
```

**Example 4**
```
Extract Logic from the Functional Specification (Inventory).
How does the "Stock Reservation" system handle concurrent orders?
```

**Example 5**
```
Extract Logic from the Discount Policy Spec.
When can a "Percentage Off" coupon be combined with a "Free Shipping" voucher?
```

---

## 4. UI Consistency and Event Mapping

**Example 1**
```
Check UI Consistency and Event Mapping between the Screen Spec and the API Spec.
Which API endpoint is triggered when the "Confirm Purchase" button is clicked on the Checkout Screen?
```

**Example 2**
```
Check UI Consistency and Event Mapping between the Screen Spec and the Logic Spec.
How does the "Enable 2FA" toggle map to the "Two-Factor Authentication Setup" flow in the Security Functional Spec?
```

**Example 3**
```
Check UI Consistency and Event Mapping between the Screen Spec and Error Handling.
What error codes align with the "Login Failed" message on the Login Screen Design?
```

**Example 4**
```
Check UI Consistency and Event Mapping between the Mobile UI Spec and the Data Spec.
What backend data field controls the "Low Stock" label visibility on the Product Detail Screen?
```

**Example 5**
```
Check UI Consistency and Event Mapping between the Dashboard UI and Reporting Logic.
How do the date range picker options on the Admin Dashboard map to the Analytics Reporting Service query parameters?
```

---

## 5. Cross-referencing and Impact Analysis

**Example 1**
```
Perform Cross-referencing and Impact Analysis on the Global Data Model.
What Screen Specs and API Specifications will be affected if customer_id changes from Integer to UUID?
```

**Example 2**
```
Perform Cross-referencing and Impact Analysis on the Authentication Module.
Which Mobile Screen Specs and Third-Party Integration Specs depend on the v1/login endpoint?
```

**Example 3**
```
Perform Cross-referencing and Impact Analysis on the Functional Specification.
Which modules reference the "Tax Calculation" logic in the Billing Module?
```

**Example 4**
```
Perform Cross-referencing and Impact Analysis on User Role Definitions.
What Feature Specifications and UI components reference the "Editor" role permissions?
```

**Example 5**
```
Perform Cross-referencing and Impact Analysis on API Dependency.
What Logic Specs and UI Mappings will break if the Weather API vendor is changed?
```

---

## 6. Specification Analysis using 1H5W

**Example 1**
```
Analyze the Incident Reporting module using the 1H5W framework.
Who reports incidents in the "Incident Reporting" workflow?
```

**Example 2**
```
Analyze the Data Archival strategy using the 1H5W framework.
When does data archival happen according to the Data Retention Policy?
```

**Example 3**
```
Analyze the User Onboarding process using the 1H5W framework.
What steps are involved in the "New User Onboarding" process?
```

**Example 4**
```
Analyze the System Maintenance Schedule using the 1H5W framework.
Where are users redirected during "Scheduled Maintenance"?
```

**Example 5**
```
Analyze the API Authentication flow using the 1H5W framework.
How is the OAuth2 token refreshed in the Security Spec?
```