---
type: inbox_log
created: 2026-01-10
---

# Inbox Log

This file maintains an audit trail of all captures processed by the Second Brain system.

Each entry includes:
- Timestamp of capture
- Original input text
- Classification decision (category)
- Confidence score
- File location where it was saved
- Any extracted metadata

---

<!-- Entries will be appended below in reverse chronological order (newest first) -->

## 2026-01-10 17:13:17 [GitHub Issue #6]
**Input**: "Craig Patterson called and said we need to get together. He's just closed Paramo

Craig Patterson called and said we need to get together. He's just closed Paramount Media in Africa and is starting hi..."
**Classification**: person
**Confidence**: 95%
**Context**: work
**Locations**:
  - md/people/business/craig-patterson.md
  - md/inbox/inbox-log.md
**Reason**: Contains information about a person (Craig Patterson) with relationship context and business interaction details

---


## 2026-01-10 16:57:24 [GitHub Issue #5]
**Input**: "set up my "dare" project and add these todo:

- implement scoring system
- add player view"
**Classification**: project
**Confidence**: 92%
**Context**: personal
**Locations**:
  - md/projects/personal/active/dare.md
  - md/inbox/inbox-log.md
**Reason**: User explicitly mentions setting up a 'project' and provides specific todo items with technical implementation tasks

---


## 2026-01-10 13:35:12 [GitHub Issue #4]
**Input**: "Add to supplements: NLC and vitamin D

add to dare project: enable scoring system"
**Classification**: admin_urgent
**Confidence**: 92%
**Context**: personal
**Locations**:
  - md/shopping.md
  - md/admin/personal/urgent.md
  - md/inbox/inbox-log.md
**Reason**: Two distinct tasks: shopping item (supplements) and project update (dare project scoring)

---


## 2026-01-10 13:20:45 [GitHub Issue #3]
**Input**: "Test restructure

Buy apples and bananas for testing new /md structure"
**Classification**: shopping
**Confidence**: 95%
**Context**: personal
**Locations**:
  - md/shopping.md
  - md/inbox/inbox-log.md
**Reason**: Clear shopping pattern with 'Buy' keyword and list of grocery items

---


## 2026-01-10 12:17:30 [GitHub Issue #2]
**Input**: "Add to M2B project:
- PWA to list Md files structured
- PWA to allow voice capture


"
**Classification**: project
**Confidence**: 92%
**Context**: personal
**Locations**:
  - projects/personal/active/m2b-pwa-enhancement.md
  - inbox/inbox-log.md
**Reason**: Clear project reference with specific technical tasks and features to implement

---


## 2026-01-10 11:48:39 [GitHub Issue #1]
**Input**: "buy mortein and snacks. add to supplements shopping list: TMG, NACL, L-carnatine

"
**Classification**: shopping
**Confidence**: 95%
**Context**: personal
**Locations**:
  - shopping.md
  - inbox/inbox-log.md
**Reason**: Clear shopping request with specific items for different categories

---



## 2026-01-10 14:45:00
**Input**: "buy mortein and snacks. add to supplements shopping list: TMG, NACL, L-carnatine"
**Classification**: shopping
**Confidence**: 95%
**Location**: shopping.md (General and Supplements sections)
**Extracted**:
  - General items: mortein, snacks
  - Supplement items: TMG, NACL, L-carnatine
  - Context: personal

---
## 2026-01-10 14:45:22
**Input**: "Add to M2B project: - PWA to list Md files structured - PWA to allow voice capture"
**Classification**: project
**Confidence**: 92%
**Location**: projects/personal/active/m2b-pwa-enhancement.md (updated)
**Extracted**:
  - Project: M2B PWA Enhancement
  - Next actions: PWA file listing, voice capture
  - Domain: tech
  - Context: personal
  - Tags: PWA, markdown, voice-capture, web-app

---


## 2026-01-10 14:35:22
**Input**: "Buy apples and bananas for testing new /md structure"
**Classification**: shopping
**Confidence**: 95%
**Location**: shopping.md (Groceries section)
**Extracted**:
  - Items: apples, bananas
  - Category: groceries
  - Context: personal
  - Notes: for testing new /md structure

---

## 2026-01-10 14:35:22
**Input**: "Add to supplements: NLC and vitamin D\n\nadd to dare project: enable scoring system"
**Classification**: admin_urgent (multi-item)
**Confidence**: 92%
**Locations**:
  - md/shopping.md (supplements added)
  - md/admin/personal/urgent.md (task added)
**Extracted**:
  - Shopping items: NLC supplement, Vitamin D
  - Task: Enable scoring system for dare project
  - Context: personal

---

## 2026-01-10 14:45:30
**Input**: "set up my 'dare' project and add these todo: - implement scoring system - add player view"
**Classification**: project
**Confidence**: 92%
**Location**: md/projects/personal/active/dare.md (created)
**Extracted**:
  - Title: Dare
  - Status: active
  - Context: personal
  - Next actions: implement scoring system, add player view
  - Tags: game, development

---

## 2026-01-10 14:00:00
**Input**: "Craig Patterson called and said we need to get together. He's just closed Paramount Media in Africa and is starting his own thing. He needs 15 million rent of funding. I set out hook him up with Rowan."
**Classification**: person
**Confidence**: 95%
**Location**: md/people/business/craig-patterson.md (created)
**Extracted**:
  - Name: Craig Patterson
  - Relationship: business_contact
  - Context: work
  - Tags: paramount_media, africa, funding, startup
  - Last interaction: phone call 2026-01-10
  - Key details: Closed Paramount Media Africa, starting new venture, needs 15M funding, connected with Rowan

---