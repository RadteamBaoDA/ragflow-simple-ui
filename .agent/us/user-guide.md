# Requirement: Embedded Interactive User Guideline System
## Feature Overview
Develop an embedded "User Guideline" system that provides both a high-level overview and an interactive step-by-step walkthrough for all major features. The system must adapt dynamically based on the user's active language, current role, and the specific module they are viewing.

## General Requirements
- Format: A responsive, multi-tabbed Modal/Dialog component.
- Persistence: Track "First Time Visit" state to auto-trigger guidelines or allow users to reopen them via a "Help" icon.
- Localization: Full support for English (EN), Vietnamese (VN), and Japanese (JP).

## Role-Based Content (RBAC)
- User Role: Access to AI Chat and AI Search guidelines.
- Leader Role: Access to Knowledge Base + User Role guidelines.
- Admin Role: Access to IAM, Administrator, + all lower role guidelines.

## Maintainability: 
- All guideline content (text, step order, image keys) must be centralized in a structured .ts file.
- Each screen have sperate guideline file for each language.

## Detailed UI/UX Specifications

### Dialog Structure
- Header: Title of the current module guideline and a Close button.
- Sidebar/Tabs: Vertical or horizontal tabs to switch between different sub-features (e.g., in AI Chat: "General Chat", "Prompt Library", "History").
- Main Content Area:
  - Overview Mode: Summary text + introduction video/image.
  - Step-by-Step Mode: Carousel or list of steps with images, descriptions, and "Next/Previous" buttons.
  - Language Switcher: Synced with the main application's language state.

### Interactive "Guided Tour" (Optional Enhancement)
- Ability to launch a "Live Tour" from the dialog that uses highlighters/tooltips to point to actual UI elements on the screen.

### Feature Mapping & Content Structure
- Module 1: AI Chat (User Role)
  - Overview: How the AI assistant helps with daily tasks.
  - Steps:
    - Agent Selection: Selecting the right persona.
    - Prompt Library: Using pre-defined templates, search, filter to find prompt.
    - Action Bar: Zooming, resetting sessions, and clearing history.
    - History: Managing past conversations.

- Module 2: AI Search (User Role)
  - Overview: Semantic search capabilities across internal documents.
  - Steps:
    - Search Query: How to enter effective search terms.
    - Result View: Understanding AI Summaries vs. File Results.
    - Metadata Filters: Filtering by name, thumbnail, or text snippets.

- Module 3: Knowledge Base (Leader Role)
  - Configuration: Setup for AI Chat/Search (CURD).
  - Prompts: Managing the organizational Prompt Library and search filters.

- Module 4: IAM & Admin (Admin Role)
  - IAM: User/Team lifecycle management.
  - Admin: Audit logs, Broadcast messaging, and Global system histories.

### Implementation Logic (guideline.ts)
The source code must follow a strict interface to ensure consistency.
``` typescript
interface IGuidelineStep {
  id: string;
  title: { [key: string]: string }; // EN, VN, JP
  description: { [key: string]: string };
  imageKey: string; // References localized image paths
}
```

``` typescript
interface IFeatureGuideline {
  featureId: string;
  roleRequired: 'User' | 'Leader' | 'Admin';
  overview: { [key: string]: string };
  tabs: {
    tabId: string;
    tabTitle: { [key: string]: string };
    steps: IGuidelineStep[];
  }[];
}
```

### Image Management Workflow
- Naming Convention: {feature}_{step}_{lang}.png (e.g., ai_chat_step1_vn.png).
- Capture Protocol:
  - Use /capture workflow for each screen state.
- Switch language → Capture → Repeat for all 3 languages.
- Ensure UI elements (buttons, menus) are clearly highlighted in screenshots.

### Instructions for Development
- Planning: Group screens by role and feature ID.
- Data Entry: Populate the guideline.ts file with all translated strings and image paths.
- Component Dev: Create the GuidelineDialog component using the data structure from step 2.
- Trigger Logic: Implement a check on page load: if (user.isNew && !hasSeenGuideline(featureId)) openDialog().