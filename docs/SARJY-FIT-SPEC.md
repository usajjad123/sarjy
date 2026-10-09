# Sarjy Fit — Voice-First AI Nutrition Tracker

## 1. Product Overview

Build **Sarjy Fit**, a voice-first AI nutrition tracker that eliminates the friction of traditional calorie-tracking apps.

**Core philosophy:** Users should track food as easily as telling someone what they ate.

Traditional apps require searching foods, selecting quantities, navigating forms, and repeating these steps daily. Sarjy Fit replaces most of this with natural conversation, persistent memory, and automatic nutritional calculations.

The application is being developed as a take-home assignment for Sarj AI, a Saudi Voice AI startup.

### Product principles
- **Voice-first, not voice-only:** Voice is the primary interface, but text and manual editing remain available.
- **Passive by default:** Log food without unsolicited advice or judgment.
- **Accuracy over invented precision:** Use verified nutritional data, not LLM-generated calorie estimates.
- **Minimal friction:** Ask clarifying questions only when ambiguity materially affects accuracy.
- **Memory-driven:** Remember products, usual meals, serving sizes, and preferences.
- **Transparent:** Show nutritional sources, estimates, and editable records.
- **Responsive:** UI updates immediately after successful operations.

**Product tagline:** Eat normally. Track effortlessly.

---

## 2. Core User Experience

The application is a **nutrition dashboard controlled through natural conversation**, not a traditional chatbot.

### Example conversation

User: "I ate 200 grams of chicken breast, 150 grams of cooked rice, and 5ml of olive oil."

Sarjy:
- Identifies three foods and their quantities.
- Resolves nutritional data from an external API or saved food library.
- Calculates calories, protein, carbohydrates, and fat.
- Saves the meal.
- Immediately updates the dashboard.
- Briefly confirms the result by voice.

User: "Actually, make the chicken 180 grams."

Sarjy updates the existing entry rather than creating another.

User: "Undo that."

Sarjy restores the previous quantity.

User: "How much protein have I eaten today?"

Sarjy reads the actual database totals and answers accurately.

User: "Remember this as my usual lunch."

Sarjy saves a reusable meal definition.

Next session:

User: "Log my usual lunch."

Sarjy retrieves and logs the saved meal without asking for every ingredient again.

### Essential UI

Build a polished, responsive interface containing:
- Daily calorie progress against a configurable target.
- Protein, carbohydrate, and fat progress.
- Today's meals and individual foods.
- Live voice conversation interface with listening/speaking states.
- Real-time transcription/captions.
- Editable food entries and quantities.
- Saved foods and reusable meals.
- Conversation history.
- Visible assistant actions and error feedback.

The dashboard should react to voice commands without requiring navigation through forms.

---

## 3. Core Functional Requirements

### A. Real-Time Voice Assistant

Use **Gemini Live API** initially.

Requirements:
- Natural bidirectional voice interaction.
- Low-latency streaming audio.
- Interruption/barge-in support where supported.
- Live transcription when available.
- Structured tool calls for application actions.
- Text input fallback.

Design a lightweight provider abstraction for future AI providers, but implement only Gemini initially.

### B. Conversational Food Logging

Support:
- Multiple foods in a single utterance.
- Quantities in grams, milliliters, pieces, servings, etc.
- Preparation distinctions (raw/cooked/boiled/fried).
- Natural-language corrections.
- Adding/removing foods from existing meals.
- Logging meals for previous dates.
- References such as "same as yesterday."
- Undo operations.
- Questions about daily intake and remaining targets.

Use a structured workflow:

`Speech → Intent Extraction → Food Resolution → Validation → Calculation → Database Mutation → UI Update → Voice Confirmation`

Never treat an LLM's verbal confirmation as proof that an operation succeeded.

### C. Nutrition Data Integration

Use **USDA FoodData Central** as the initial external API.

It provides nutritional data for generic foods such as chicken, eggs, and rice.

The LLM interprets user intent but **does not invent nutritional values or perform authoritative calculations**.

A deterministic nutrition engine handles:
- Unit normalization.
- Portion conversions.
- Per-100g calculations.
- Calorie and macronutrient totals.
- Daily aggregations.

Preserve source references and distinguish raw versus cooked foods.

When quantities or food matches are ambiguous, ask focused clarification questions or explicitly label provisional estimates.

### D. Persistent Memory

Implement two types of memory.

**Personal memory:**
- Nutritional goals and targets.
- Dietary preferences.
- Preferred units.
- Usual portion sizes.
- Common food choices.

**Food memory:**
- Previously confirmed products.
- Saved meals and recipes.
- Alternative names/aliases.
- Frequently consumed foods.

Examples:
- "Remember that I usually eat 150g of Greek yogurt."
- "Save this as my usual breakfast."
- "I've changed my protein goal to 160g."
- "Forget my old breakfast."

Memories must persist across sessions.

Saved meal definitions can change, but historical food logs must preserve their original nutritional snapshots.

Users should be able to inspect, edit, and delete saved memories.

### E. Nutrition Label Uploads (Phase 2)

**Important: Do NOT implement food-photo calorie estimation or meal-image recognition.**

Image uploads are exclusively for extracting information from photographed nutrition facts labels and ingredient lists.

Workflow:

1. User uploads a nutrition-label photo.
2. Multimodal AI extracts product information, calories, macros, serving size, and units.
3. Normalize values carefully, distinguishing per-serving and per-100g information.
4. Display extracted values for user verification.
5. Save the confirmed product in the user's personal food library.
6. Allow future voice logging using the saved product.

Example:

User uploads a Greek yogurt label.

Sarjy: "I found 120 calories and 10g protein per 100g. Save this product?"

User: "Yes, and remember I usually eat 150g."

Later: "Log my usual yogurt."

The application calculates nutrients using the confirmed saved data.

Preserve the original label image and extraction provenance.

### F. Smart Nutrition Companion (Later)

Support optional questions such as:
- "What can I eat to reach my protein goal?"
- "Suggest a higher-fiber alternative."
- "How can I reduce calories in this meal?"
- "What foods contributed most to my protein today?"

Advice must be user-initiated, practical, and grounded in available data.

No unsolicited food criticism or medical claims.

---

## 4. Technical Architecture

### Preferred stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui.
- **AI/Voice:** Gemini Live API.
- **Backend:** Next.js server routes/services.
- **Database:** PostgreSQL.
- **ORM:** Drizzle or Prisma.
- **Nutrition API:** USDA FoodData Central.
- **Deployment:** Vercel and managed PostgreSQL.
- **State:** React/Zustand as appropriate.

Keep architecture modular without introducing unnecessary microservices, queues, Redis, or vector databases.

### Main backend modules

```text
src/
  features/
    voice/
    conversation/
    food/
    nutrition/
    food-logging/
    memory/
    meals/
    dashboard/
    labels/        # Phase 2
```

Responsibilities:

**Voice Service:** Manages AI audio sessions and provider interactions.

**Conversation Engine:** Maintains conversational context, pending clarifications, and tool calls.

**Food Resolver:** Matches extracted food descriptions to saved products or external nutritional records.

**Nutrition Engine:** Performs deterministic calculations and unit conversions.

**Food Logging Service:** Executes validated, persistent food-log operations.

**Memory Service:** Manages user preferences, saved products, and reusable meals.

**Dashboard:** Displays authoritative server state and responds to successful mutations.

---

## 5. Structured Commands

AI proposes validated commands instead of directly modifying application state.

Example:

```typescript
type FoodCommand =
  | {
      type: "ADD_FOOD";
      mealId: string;
      foodId: string;
      grams: number;
    }
  | {
      type: "UPDATE_QUANTITY";
      entryId: string;
      grams: number;
    }
  | {
      type: "REMOVE_FOOD";
      entryId: string;
    }
  | {
      type: "UNDO";
      operationId: string;
    };
```

Extend these commands for meal creation, saved meals, targets, and historical queries.

Backend responsibilities:
- Validate commands and ownership.
- Prevent duplicate operations through idempotency.
- Resolve references correctly.
- Handle concurrent or interrupted operations.
- Persist changes transactionally.
- Return authoritative results.
- Support undo where applicable.

Never parse unstructured assistant messages to mutate the database.

---

## 6. Conversational Reliability

This is the **primary technical deep dive** for the assignment: **Multistep Workflows**.

The assistant must reliably handle conversational state.

Important test scenarios:

| Input | Expected behavior |
|---|---|
| "I ate three eggs." | Add three eggs |
| "Actually, two." | Update existing quantity |
| "Add a banana." | Add banana to relevant meal |
| "Remove the banana." | Remove correct entry |
| "Undo that." | Restore last operation |
| "Same breakfast as yesterday." | Retrieve and log previous breakfast |
| "I ate this last night." | Associate with correct date |
| User repeats a command after interruption | Avoid duplicate writes |
| User asks unrelated question mid-workflow | Preserve pending workflow |
| Nutrition API fails | Explain failure; never fabricate verified values |

Use explicit state for pending clarifications and persist important workflow state.

Support reliable recovery after errors, interruptions, and refreshes.

---

## 7. Data Model Guidelines

Core entities:

- `User`
- `UserPreferences`
- `Conversation`
- `ConversationMessage`
- `Food`
- `FoodNutrientProfile`
- `FoodLog`
- `Meal`
- `SavedMeal`
- `SavedMealIngredient`
- `Memory`
- `OperationLog`
- `NutritionLabel` (Phase 2)

Important decisions:

- Food definitions and actual consumption records are separate.
- Historical logs store immutable nutrient snapshots.
- Saved recipes can be modified without changing old logs.
- User data and memories are isolated.
- Every nutrient record retains its source.
- Track operation IDs for idempotency and undo.
- Associate consumed foods with the user's local date/timezone.

---

## 8. Product Scope and Priorities

### Phase 1 — Assignment MVP

Implement completely:

1. Real-time Gemini voice conversation.
2. Natural-language multi-food logging.
3. USDA nutrition API integration.
4. Deterministic nutritional calculations.
5. Persistent PostgreSQL food logs.
6. Responsive calories/macros dashboard.
7. Natural-language corrections and undo.
8. Cross-session user memory.
9. Saved foods and reusable meals.
10. Publicly accessible deployment.

### Phase 2 — Product Expansion

- Nutrition-label photo extraction.
- Personal packaged-food library.
- Editable label verification.
- More advanced meal aliases and portions.
- Improved conversational context.

### Phase 3 — Intelligence

- Personalized meal alternatives.
- Protein/fiber recommendations.
- Weekly nutrition insights.
- Optional weight and fitness progress tracking.

Do not sacrifice Phase 1 reliability to implement Phase 2 or 3.

---

## 9. Success Criteria

Target metrics:

- Straightforward meal logging in under 10 seconds.
- One voice utterance for complete, unambiguous meals.
- Correct handling of multi-food commands.
- Reliable edit, remove, and undo operations.
- No duplicate food logging on retried commands.
- Cross-session persistence.
- Deterministic calculations matching selected nutrition records.
- Transparent handling of missing nutritional information.
- Stable, publicly accessible deployment.

Create automated tests for at least 30 representative conversational scenarios.

Measure workflow success, food-resolution accuracy, clarification frequency, and latency.

---

## 10. Sarj Assignment Presentation

The assignment requires:
1. Working voice assistant.
2. Cross-session memory.
3. At least one useful external API.
4. Public deployment.
5. One technical deep dive.

**Chosen deep dive: Multistep Workflows.**

Demo sequence:

1. Log several foods in one voice command.
2. Observe dashboard updating.
3. Correct a quantity.
4. Remove an item.
5. Undo the removal.
6. Save the meal as a reusable favorite.
7. Reload and log the saved meal through voice.
8. Ask for daily protein/calorie totals.
9. Demonstrate recovery from ambiguous input or failed operations.

Explain the conversational state machine, structured commands, food resolution, deterministic nutrition calculations, and database consistency.

**Engineering emphasis:** This is not simply a chatbot connected to a calorie database. It is a reliable conversational interface for managing structured nutritional data.

---

## 11. Development Instructions

Start with a clean, extensible architecture.

Prioritize:
1. Correct data models and application boundaries.
2. Deterministic nutrition calculations.
3. Reliable structured command execution.
4. Persistent memory and food logging.
5. Gemini Live voice integration.
6. Reactive dashboard and polished UX.
7. Automated testing and deployment.

Avoid premature abstractions and excessive infrastructure.

Build the smallest functional end-to-end experience first, then improve it incrementally.

**Final goal:** Deliver a polished, production-minded voice-first nutrition tracker where users can log, correct, remember, and understand their food intake through natural conversation with minimal effort.