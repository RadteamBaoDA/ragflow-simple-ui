# Context:
I have implement this plan https://github.com/RadteamBaoDA/ragflow-simple-ui/blob/main/plans/solution1.md to my RAG system to implement generative mode to using current knowledge base:
After implement I have something need to improve,  i need your advance to what is best solution for cost, effective, quality output and performance
# Chat user input
##  Required Markdown Headers

The user input must use this structure:

```md
# User profiles

# Task

# Context

# Keyword

# Output format
```
# Agent user input
User can prompt freestyle by natural language or have below headers:

```md
# Task

# Context

# Keyword

# Output format
```

1. I have implement the agent standard and I want reuse the orchestrator solution to this agent, the agent will have predefine the instruction only, and this instruction may be have a skill,  User profiles  and Output format, user may just prompt their natural language to generative output base on agent instruction or include # Task # Context # Keyword like generative mode in chat.
Is I can reuse this orchestration to new agent standard mode and what i must to do.

2. The planner need more effective, support multi use case and smarter for base on # Task # Context and $#Requirement Heading from user prompt or agent instruction, I need smart plan for retrieve phase, I have some case just base on some exist document in knowledge base, retrieve and then create new base on task and requirement like refer old use case to create new use case. Or case generate output base on the chunk like  exist requirement, create test case, detail design, basic design, test spec ..... All of them must using llm to detect from user input and create plan more smarter every case in software development, healthcare, etc, need cover all general case for generate agent.

3. the outliner must more effctive and strictly follow the output format, and is this phase nessasary 

4. Because the plan is base on task or hint from user prompt to each plan stage need retrieve data or not, i think phase retriever and reranker need merge to sectionWriter phase, base on plan phase will retrieve parralel for context to generate output, and how to base on user prompt(chat generate have require header in # Chat user input) and for agent standard is agent instruction and user prompt for better output. I think the cititation: Citation check (every `[N]` resolves to a chunk used in that section). using need include on this phase on LLM system prompt to output section for reference if this section is using this chunk for reference and generate output

5. Is ### Phase 6 — Section-by-Section Generation you must provide me some solution to ignore Hallucination, and quality output. is need re-act or loop solution to small evaluate each chunk when retrievel is enough context for generative each task, requirement and phase.

6. Update the Phase 7 — Stitch, Validate, Refine just validation only and do not need to print anything not include on header #OUTPUT FORMAT like Final title, TOC, sections, references .... JUST VALIDATE the output is correct with user task and requriement 