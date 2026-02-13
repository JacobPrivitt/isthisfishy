# IsThisFishy

WIP Readme

Main software components
- chrome extension
- backend
- clerk auth
- sqlite user management (sqlalchemy for ORM)
- stripe payments
- openai inference

Things to figure out
- what llm orchestrator do we use? langchain/langgraph/agents SDK?
- how do we want to deploy? docker
- how to use clerk, and how to do stripe subscriptions
- figure out data model for user management
- set up docker compose infrastructure 
- figure out what backend server to use (flask/fastapi)


Things to do
- docker compose infrastructure
- set up chrome extension for
  - register
  - subscribe
  - overlay gmail
  - detect spam
  - unregister and delete account
  - forgot password
- set up backend for
  - user can register
  - user can subscribe
  - take user content and return spam summary and score
  - routes must be robust and always check whether a user has a valid accoutn and a valid subscription
  - anything the extension needs to do


- Future considerations
  - azure / AWS docker hosting bc fuck buying a VPS lol
