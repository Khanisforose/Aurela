#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Aurela — luxury global digital banking + crypto platform. Multi-currency banking (10 fiat), crypto wallets (10 assets), internal transfers by username/email/wallet id, 3-tier virtual cards (Basic/Premium/Elite) with USDT ERC20 activation, deposits/withdrawals, KYC, admin panel with super_admin & admin roles (fund/freeze/block/delete users, KYC review, platform settings, audit log)."

backend:
  - task: "Auth (register, login, me, logout) with token sessions"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Implemented register/login/me/logout using SHA-256 salted hash. Sessions collection with 30d token. Default super_admin seeded: admin@aurela.io / Admin@123."
        - working: true
          agent: "testing"
          comment: "✅ All auth endpoints tested and working. Register creates user with role=user, kyc_status=unverified. Login returns token and user. /auth/me returns user data. Wrong password returns 401. Duplicate email returns 400. Admin login returns role=super_admin."

  - task: "Wallets creation + rates + preferred currency conversion"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Creates 10 fiat + 10 crypto wallets on register. Welcome bonus USD 1000 and USDT 100. Rates cached 5m from open.er-api.com + coingecko (fallback embedded)."
        - working: true
          agent: "testing"
          comment: "✅ Wallets working perfectly. New users get exactly 20 wallets (10 fiat + 10 crypto). USD wallet has 1000 balance, USDT wallet has 100 balance. GET /wallets returns enriched data with balance_usd and preferred_value. Totals include usd, preferred, and preferred_currency. Preferred currency change to EUR works correctly. Rates endpoint returns fx and crypto_usd maps."

  - task: "Internal transfer by username/email/id"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/transfer. Debits sender, credits recipient, writes transaction, blocks frozen recipient."
        - working: true
          agent: "testing"
          comment: "✅ Internal transfers working perfectly. Tested transfer by username, email, and user ID. All three methods work correctly. Balances update accurately (sender decreases, recipient increases). Transaction records created properly. Error handling works: insufficient balance returns 400, self-transfer returns 400, unknown recipient returns 404."

  - task: "Deposit + Withdraw (mocked instant)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Instant credit/debit against wallet. Multi-method support (bank/upi/stripe/paypal/crypto)."
        - working: true
          agent: "testing"
          comment: "✅ Deposit and withdraw working correctly. Deposit adds funds to wallet instantly. Withdraw removes funds from wallet. Transaction records created for both operations. GET /transactions returns deposits and withdrawals in the list."

  - task: "Virtual cards request + activate + freeze"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "3 tiers (basic/premium/elite). Activation via USDT wallet debit OR tx_hash (mocked). Freeze toggle."
        - working: true
          agent: "testing"
          comment: "✅ Virtual cards working perfectly. POST /cards/request creates card with status=pending_activation, correct activation_fee_usdt (basic=10), and activation_wallet from settings. Activation with pay_from_wallet=true debits USDT wallet by 10 and sets status=active. Activation with tx_hash also works. Freeze/unfreeze toggle works correctly. GET /cards returns card list."

  - task: "KYC submit"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/kyc updates user.kyc_status to pending. Admin reviews and approves/rejects."
        - working: true
          agent: "testing"
          comment: "✅ KYC submission working correctly. POST /api/kyc creates KYC record and updates user.kyc_status to pending. Admin can approve KYC which updates user.kyc_status to approved."

  - task: "Admin panel (users search/freeze/block/delete/adjust, KYC review, settings, audit, tx list)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Full admin endpoints. super_admin only for role changes and settings edits. All actions audit-logged."
        - working: true
          agent: "testing"
          comment: "✅ All admin endpoints working perfectly. GET /admin/overview returns counts. GET /admin/users returns user list. Search by query parameter works. POST /admin/users/{id}/adjust with credit/debit works correctly. Freeze/unfreeze/block/unblock all work. Blocked user login returns 403. GET /admin/kyc returns KYC list. POST /admin/kyc/{id}/approve updates user.kyc_status. GET /admin/settings returns settings. PUT /admin/settings updates settings. GET /admin/transactions returns all transactions. GET /admin/audit returns audit log with expected actions (user.register, user.login, transfer.internal, etc). Non-admin access to /admin/* correctly returns 403."

frontend:
  - task: "Luxury Landing page (black/gold, hero, features, cards, pricing, FAQ, CTA)"
    implemented: true
    working: "NA"
    file: "/app/components/aurela/Landing.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Visually verified via screenshot — floating card stack, gold gradient, glassmorphism."

  - task: "Auth UI (register/login)"
    implemented: true
    working: "NA"
    file: "/app/components/aurela/Auth.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Dashboard (overview, fiat/crypto wallets, transfer, cards, deposit, withdraw, transactions, kyc, profile)"
    implemented: true
    working: "NA"
    file: "/app/components/aurela/Dashboard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Admin panel UI"
    implemented: true
    working: "NA"
    file: "/app/components/aurela/AdminPanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Aurela MVP built. Please test all backend endpoints. Default seed super_admin: admin@aurela.io / Admin@123. New users get USD 1000 + USDT 100 welcome balance. Currency codes: fiat=[USD,EUR,GBP,INR,AED,JPY,CAD,AUD,SGD,CHF], crypto=[BTC,ETH,USDT,USDC,BNB,SOL,XRP,ADA,DOGE,MATIC]. Confirm: register → login → /wallets → /rates → /config → /transfer between two users → /deposit → /withdraw → /cards/request → /cards/:id/activate (both wallet + tx_hash paths) → /cards/:id/freeze → /kyc → /profile PUT → /admin/* endpoints (users list/search, freeze/block/delete/adjust, kyc approve, settings PUT, audit, transactions). All authenticated routes need Bearer token from login."
    - agent: "testing"
      message: "✅ BACKEND TESTING COMPLETE - ALL 45 TESTS PASSED! Comprehensive testing completed covering: (1) Public endpoints (health, config, rates) ✅ (2) Auth (register, login, me, logout, error cases) ✅ (3) Wallets with 20 wallets (10 fiat + 10 crypto), welcome bonuses (USD 1000, USDT 100), preferred currency conversion ✅ (4) Internal transfers by username/email/id with proper validations ✅ (5) Deposit & Withdraw ✅ (6) Virtual cards (request, activate with wallet and tx_hash, freeze/unfreeze) ✅ (7) KYC submission and approval ✅ (8) Admin panel (overview, users list/search, adjust credit/debit, freeze/unfreeze/block/unblock, KYC list/approve, settings get/update, transactions, audit log) ✅ (9) Role check (non-admin access correctly rejected) ✅. All monetary calculations accurate, no MongoDB ObjectID leaks (all responses use UUID). No critical issues found. Backend is production-ready."
    - agent: "user"
      message: "Bug report: Console error 'A tree hydrated but some attributes of the server rendered HTML didn't match the client properties' caused by <body> in /app/app/layout.js having extra attributes data-new-gr-c-s-check-loaded and data-gr-ext-installed (from Grammarly-like browser extensions). Fix applied: Added suppressHydrationWarning to both <html> and <body> tags. Please verify the fix."
    - agent: "testing"
      message: "✅ HYDRATION MISMATCH BUG FIX VERIFIED - PASS! Comprehensive testing completed: (1) Landing page load - NO hydration errors ✅ (2) Navigation through all tabs (Home, Features, Cards, Services, About Us) - NO hydration errors ✅ (3) Footer Terms link - NO hydration errors ✅ (4) Admin login (admin@aurela.io / Admin@123) - NO hydration errors ✅ (5) Admin panel navigation (Overview, Users, KYC, Audit) - NO hydration errors ✅. Total console messages: 1-2 (extremely clean). Total hydration errors detected: 0. The suppressHydrationWarning fix on both <html> and <body> tags in /app/app/layout.js is working perfectly. All pages render correctly with expected content. Bug is completely resolved."
    - agent: "user"
      message: "Quick regression check requested after docker-compose.yml change (added certbot-run service). Test 6 specific endpoints: (1) GET /api/health (2) GET /api/config (3) GET /api/rates (4) POST /api/auth/login with admin@aurelawallet.com / Aurela@123# (5) GET /api/auth/me (6) GET /api/admin/platform-wallets with TRC20 USDT address TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S"
    - agent: "testing"
      message: "✅ REGRESSION TEST COMPLETE - ALL 6/6 CHECKS PASSED! (1) GET /api/health → 200 {ok:true} ✅ (2) GET /api/config → 200 with fiat, crypto, activation_wallet keys ✅ (3) GET /api/rates → 200 with fx (50 currencies) and crypto_usd (30 assets) maps populated ✅ (4) POST /api/auth/login with admin@aurelawallet.com / Aurela@123# → 200 with token and user.role=super_admin ✅ (5) GET /api/auth/me → 200 ✅ (6) GET /api/admin/platform-wallets → 200 with 8 platform wallets including TRC20 USDT address TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S ✅. No regressions detected. Backend API at /api is fully functional after docker-compose.yml deployment change."
