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

  - task: "KYC gating on deposit/withdraw/card request/card activate"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Message 295 changes: All deposit/withdraw/card endpoints now return 403 with code=KYC_REQUIRED when user.kyc_status !== 'approved'."
        - working: true
          agent: "testing"
          comment: "✅ KYC gating working perfectly (4/4 tests passed). Fresh user with kyc_status='unverified' correctly blocked from: (1) POST /deposit → 403 with code=KYC_REQUIRED ✅ (2) POST /withdraw → 403 with code=KYC_REQUIRED ✅ (3) POST /cards/request → 403 with code=KYC_REQUIRED ✅ (4) POST /cards/{id}/activate → 403 with code=KYC_REQUIRED ✅. All endpoints return proper error messages and status codes."

  - task: "Deposit request pending flow + admin approve/reject"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Message 295 changes: POST /deposit creates deposit_request with status='pending' (no auto-credit). Admin endpoints: GET /admin/deposits, POST /admin/deposits/:id/approve|reject."
        - working: true
          agent: "testing"
          comment: "✅ Deposit request flow working perfectly (10/10 tests passed). (1) User POST /deposit creates request with status='pending' ✅ (2) Wallet balance NOT auto-credited (remains unchanged) ✅ (3) Admin GET /deposits returns pending requests ✅ (4) Admin POST /deposits/:id/approve credits wallet + creates transaction + writes block ✅ (5) Transaction record created with type='deposit', status='completed' ✅ (6) Reject path: balance unchanged after rejection ✅. Complete flow from request → admin approval → wallet credit verified working correctly."

  - task: "Card activation via external USDT tx_hash + admin approve/reject"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Message 295 changes: Card activation removed pay_from_wallet path. Only tx_hash accepted, card goes to status='pending_verification'. Admin endpoints: GET /admin/cards (pending only), POST /admin/cards/:id/approve|reject."
        - working: true
          agent: "testing"
          comment: "✅ Card activation via external USDT working perfectly (7/7 tests passed). (1) POST /cards/request creates card with status='pending_activation' ✅ (2) POST /cards/:id/activate without tx_hash returns 400 with error about tx_hash requirement ✅ (3) POST /cards/:id/activate with tx_hash sets status='pending_verification' ✅ (4) USDT wallet balance NOT auto-debited (remains unchanged) ✅ (5) Admin GET /cards returns pending cards ✅ (6) Admin POST /cards/:id/approve sets status='active' + writes block ✅ (7) User GET /cards shows card with status='active' ✅. Complete flow from request → tx_hash submission → admin approval → activation verified working correctly."

  - task: "Google Sign-In (both credential and access_token flows)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/auth/google accepts EITHER {credential:<id_token>} OR {access_token:<oauth2 token>}. Verifies JWT signature via google-auth-library for credential flow, fetches userinfo for access_token flow."
        - working: true
          agent: "testing"
          comment: "✅ Google Sign-In working (3/3 tests passed). Empty body returns 400 'Missing Google credential' ✅. Fake access_token returns 401 ✅. Invalid credential returns 401 ✅. Both flows properly reject invalid tokens without 500 errors."

  - task: "Withdrawal admin approval pipeline with balance locking"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/withdraw creates pending withdraw_request, debits balance immediately and locks funds. Admin GET /admin/withdrawals lists pending. Admin approve releases lock + creates transaction. Admin reject returns funds to available balance."
        - working: true
          agent: "testing"
          comment: "✅ Withdrawal pipeline working perfectly (10/10 tests passed). User submits withdrawal → balance debited (500→400) + locked (0→100) ✅. Admin sees pending withdrawal ✅. Admin approves → locked released (100→0), transaction created ✅. Reject path tested: funds returned to balance (350→400), locked cleared (50→0) ✅. Complete flow verified with proper balance tracking."

  - task: "Card limits (max 3, 1 per tier) + user delete card"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /cards/request enforces max 3 cards per user and blocks duplicate tiers. DELETE /cards/:id lets user delete their own card (status='deleted', frozen=true). After delete, same tier can be requested again."
        - working: true
          agent: "testing"
          comment: "✅ Card limits working perfectly (7/7 tests passed). Basic card created ✅. Duplicate basic tier blocked with 'Only one card per tier' ✅. Premium and elite cards created ✅. 4th card blocked with 'maximum of 3' ✅. User deletes basic card ✅. Basic card re-requested successfully after delete ✅."

  - task: "24h card activation delay with activate_now option"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /admin/cards/:id/approve supports {activate_now:true} → status='active' immediately. Without it → status='activating' with usable_at = now + 24h. GET /cards auto-flips 'activating' cards to 'active' once usable_at has passed."
        - working: true
          agent: "testing"
          comment: "✅ 24h activation delay working (2/2 tests passed). Admin approve without activate_now → status='activating' with usable_at +24h ✅. Admin approve with activate_now=true → status='active' immediately ✅."

  - task: "Extended KYC form fields + admin detail endpoint"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/kyc accepts extended fields: first_name, last_name, mobile, country, state, city, address, postal_code, occupation, id_type, id_number, doc_front (base64), doc_back (base64), selfie (base64). GET /admin/kyc/:id returns {kyc, user} for review modal."
        - working: true
          agent: "testing"
          comment: "✅ Extended KYC working (3/3 tests passed). KYC submission with all extended fields + base64 images successful ✅. Admin GET /kyc lists record ✅. Admin GET /kyc/:id returns {kyc, user} with all fields including doc_front intact ✅."

  - task: "Profile avatar update with size validation"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "PUT /api/profile accepts avatar (base64), address, country, city, postal_code, date_of_birth. Avatar size guard rejects payloads > 3MB."
        - working: true
          agent: "testing"
          comment: "✅ Profile avatar working (3/3 tests passed). Avatar upload with address/city successful ✅. GET /auth/me returns avatar and address ✅. Large avatar (>3MB) rejected with 'too large' error ✅."

  - task: "Admin notifications endpoint"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/admin/notifications returns {counts:{deposits,withdrawals,kyc,cards}, total, items:[{kind,id,title,at}...]} aggregating pending actionable items."
        - working: true
          agent: "testing"
          comment: "✅ Admin notifications working (1/1 test passed). Returns correct shape with counts (deposits, withdrawals, kyc, cards), total, and items array ✅."

  - task: "Admin delete card and transaction endpoints"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "DELETE /api/admin/cards/:id deletes a card. DELETE /api/admin/transactions/:id deletes a transaction (audit-logged; does NOT reverse balances)."
        - working: true
          agent: "testing"
          comment: "✅ Admin delete endpoints working (2/2 tests passed). Admin can delete cards ✅. Admin can delete transactions ✅."

  - task: "Admin overview enhancements (deposits_pending & withdrawals_pending)"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/admin/overview now returns deposits_pending and withdrawals_pending counts in addition to previous metrics."
        - working: true
          agent: "testing"
          comment: "✅ Admin overview enhancements working (1/1 test passed). Returns deposits_pending and withdrawals_pending keys ✅."

  - task: "2FA setup endpoint"
    implemented: true
    working: true
    file: "/app/app/api/[[...path]]/route.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/profile/2fa/setup returns {secret, uri, qr_svg} for authenticator app setup."
        - working: false
          agent: "testing"
          comment: "❌ 2FA setup endpoint failing (0/1 test passed). Returns 500 Internal Server Error: 'Cannot read properties of undefined (reading generateSecret)'. Issue is with dynamic import of otplib - the import statement 'await import(otplib)' is not returning the expected object structure. This is a known ESM import issue in Next.js."
        - working: true
          agent: "testing"
          comment: "✅ 2FA setup endpoint now working (1/1 test passed). POST /api/profile/2fa/setup returns 200 with correct response structure: {secret: <32-char string>, uri: <otpauth://totp/...>, qr_svg: <svg...>}. Fix applied by main agent: replaced authenticator.generateSecret() with otp.generateSecret() and authenticator.check() with otp.verifySync({secret, token, window:1}), using otplib v13 functional API exports directly from module object. Same fix applied to /profile/2fa/enable, /profile/2fa/disable, and 2FA verification in /auth/login."

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
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "All backend endpoints tested and working"
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
    - agent: "main"
      message: "Applied Message 295 business-logic changes: (1) POST /api/deposit now creates a deposit_request with status='pending' — funds are NOT credited automatically. (2) POST /api/withdraw, /api/deposit, /api/cards/request, /api/cards/:id/activate now all return 403 with code=KYC_REQUIRED when user.kyc_status !== 'approved'. (3) Card activation removed the pay_from_wallet path entirely — only tx_hash is accepted, card goes to status='pending_verification'. (4) Added new admin endpoints: GET /api/admin/deposits, POST /api/admin/deposits/:id/approve|reject, GET /api/admin/cards (pending only), POST /api/admin/cards/:id/approve|reject. Please run a focused backend regression: A) admin login (admin@aurelawallet.com / Aurela@123#) → GET /admin/deposits, GET /admin/cards should return 200. B) Register a fresh user, then attempt POST /api/deposit, /api/withdraw, /api/cards/request → each should return 403 with KYC_REQUIRED. C) Approve KYC via admin, then POST /api/deposit → should return {ok:true, request:{status:'pending'}} and NOT increase the wallet balance. Verify wallet balance stays flat. D) Admin POST /admin/deposits/:id/approve → verifies wallet balance is now credited and transaction+block created. E) Fresh user (with KYC approved), POST /cards/request then /cards/:id/activate with tx_hash='0x' + longhash → card.status='pending_verification', USDT wallet balance UNCHANGED. Admin approve → card.status='active'. F) Rejection paths should also work. Backend file: /app/app/api/[[...path]]/route.js. Existing admin creds already in test_credentials."
    - agent: "testing"
      message: "✅ REGRESSION TEST COMPLETE - ALL 6/6 CHECKS PASSED! (1) GET /api/health → 200 {ok:true} ✅ (2) GET /api/config → 200 with fiat, crypto, activation_wallet keys ✅ (3) GET /api/rates → 200 with fx (50 currencies) and crypto_usd (30 assets) maps populated ✅ (4) POST /api/auth/login with admin@aurelawallet.com / Aurela@123# → 200 with token and user.role=super_admin ✅ (5) GET /api/auth/me → 200 ✅ (6) GET /api/admin/platform-wallets → 200 with 8 platform wallets including TRC20 USDT address TLgjfeg8Mqw5ueo1CGC8eTb4EHysPMMA6S ✅. No regressions detected. Backend API at /api is fully functional after docker-compose.yml deployment change."
    - agent: "user"
      message: "Run focused regression + new-feature test on Message 295 changes: (1) KYC gating on deposit/withdraw/cards - verify 403 with KYC_REQUIRED for unverified users. (2) Deposit request flow - verify pending status, no auto-credit, admin approve/reject. (3) Card activation via external USDT - verify tx_hash requirement, pending_verification status, no auto-debit, admin approve/reject. (4) Regression sanity - health, config, rates, transfer."
    - agent: "testing"
      message: "✅ FOCUSED REGRESSION + NEW FEATURE TEST COMPLETE - ALL 25/25 TESTS PASSED! Comprehensive testing of Message 295 business logic changes completed successfully. **SECTION 1: KYC GATING (4/4 PASSED)** - Fresh user with kyc_status='unverified' correctly blocked from deposit/withdraw/card request/card activate, all return 403 with code=KYC_REQUIRED ✅. **SECTION 2: DEPOSIT REQUEST FLOW (10/10 PASSED)** - Complete flow verified: user creates deposit request (status='pending') → wallet balance NOT auto-credited → admin GET /deposits lists pending requests → admin approves → wallet credited + transaction created + block written → reject path also works (balance unchanged) ✅. **SECTION 3: CARD ACTIVATION VIA EXTERNAL USDT (7/7 PASSED)** - Complete flow verified: user requests card (status='pending_activation') → activation without tx_hash returns 400 error → activation with tx_hash sets status='pending_verification' → USDT wallet NOT auto-debited → admin GET /cards lists pending → admin approves → card status='active' ✅. **SECTION 4: REGRESSION SANITY (4/4 PASSED)** - Health endpoint (200 ok=true) ✅, Config endpoint (200 with all keys) ✅, Rates endpoint (200 with fx + crypto_usd) ✅, Transfer between users (balances update correctly) ✅. All new business logic working correctly. No regressions detected. Backend is production-ready."
    - agent: "main"
      message: "MAJOR feature drop (18 items from user Message ~296). Please test the new/changed endpoints. Admin creds still admin@aurelawallet.com / Aurela@123#. **NEW/CHANGED BACKEND SURFACE:** (1) POST /api/auth/google now accepts EITHER {credential:<id_token>} OR {access_token:<oauth2 token>} — please test at least the shape (a real Google token can't be generated, but verify the endpoint rejects missing tokens with 400, and returns a helpful error if GOOGLE_CLIENT_ID is unset). (2) POST /api/withdraw now creates a pending 'withdraw_requests' row (status='pending'), locks wallet balance (funds are debited immediately + locked field increments). Verify balance stays deducted but no completed 'withdraw' transaction is written. Then admin GET /api/admin/withdrawals returns the list; POST /api/admin/withdrawals/:id/approve creates the withdraw transaction and unlocks; POST /api/admin/withdrawals/:id/reject returns the funds to available balance. (3) POST /api/cards/request now enforces max 3 cards per user and blocks duplicate tiers — verify: creating one basic card succeeds, second basic returns 400 with 'Only one card per tier' message; creating premium and elite succeeds; a 4th tier attempt returns 400. (4) DELETE /api/cards/:id lets user delete their own card (status becomes 'deleted', frozen=true). After delete, requesting the same tier again succeeds. (5) POST /api/admin/cards/:id/approve now supports body {activate_now:true} → status='active' immediately; without it → status='activating' with usable_at = now + 24h. GET /api/cards auto-flips 'activating' cards to 'active' once usable_at has passed. (6) POST /api/kyc now accepts extended fields: first_name, last_name, mobile, country, state, city, address, postal_code, occupation, id_type, id_number, doc_front (base64), doc_back (base64), selfie (base64). Verify KYC record contains all these. (7) GET /api/admin/kyc/:id returns { kyc, user } (detail for review modal). (8) PUT /api/profile now accepts avatar (base64), address, country, city, postal_code, date_of_birth. Test avatar upload works and rejects payloads > 3MB. (9) GET /api/admin/notifications returns { counts:{deposits,withdrawals,kyc,cards}, total, items:[{kind,id,title,at}...] } — verify shape. (10) DELETE /api/admin/cards/:id deletes a card; DELETE /api/admin/transactions/:id deletes a transaction. (11) GET /api/admin/overview now returns deposits_pending and withdrawals_pending in addition to previous counts. **DO NOT TEST 2FA setup itself with a real authenticator — just verify POST /profile/2fa/setup returns { secret, uri, qr_svg } with non-empty values (i.e., no internal server error).** Skip Google flow with a real token. Regression: confirm all previously green endpoints still work."
    - agent: "testing"
      message: "✅ MAJOR FEATURE DROP REGRESSION TEST COMPLETE - 39/40 TESTS PASSED (97.5%)! Comprehensive testing of all new features completed. **SECTION A: GOOGLE SIGN-IN (3/3 PASSED)** - Empty body returns 400 'Missing Google credential' ✅, fake access_token returns 401 ✅, invalid credential returns 401 ✅. **SECTION B: WITHDRAWAL ADMIN APPROVAL PIPELINE (10/10 PASSED)** - Complete flow verified: user submits withdrawal → balance debited + locked → admin GET /withdrawals lists pending → admin approves → locked released + transaction created ✅, reject path returns funds to balance ✅. **SECTION C: CARD LIMITS + DELETE (7/7 PASSED)** - Max 3 cards enforced ✅, duplicate tier blocked ✅, user can delete card and re-request same tier ✅. **SECTION D: 24H CARD ACTIVATION DELAY (2/2 PASSED)** - Admin approve without activate_now → status='activating' with usable_at +24h ✅, admin approve with activate_now=true → status='active' immediately ✅. **SECTION E: EXTENDED KYC + ADMIN DETAIL (3/3 PASSED)** - KYC accepts extended fields + base64 images ✅, admin GET /kyc/:id returns {kyc, user} with all fields ✅. **SECTION F: PROFILE AVATAR + EDIT (3/3 PASSED)** - Avatar upload works ✅, large avatar (>3MB) rejected ✅. **SECTION G: ADMIN NOTIFICATIONS (1/1 PASSED)** - Returns {counts, total, items} with correct shape ✅. **SECTION H: ADMIN DELETE (2/2 PASSED)** - Admin can delete cards and transactions ✅. **SECTION I: ADMIN OVERVIEW (1/1 PASSED)** - Returns deposits_pending & withdrawals_pending ✅. **SECTION J: 2FA SETUP (0/1 FAILED)** - POST /profile/2fa/setup returns 500 error due to otplib import issue ❌. **REGRESSION (7/7 PASSED)** - Health, config, rates, admin login, transfer, deposit flow, card activation all working ✅. **CRITICAL ISSUE:** 2FA setup endpoint has otplib dynamic import error (500 Internal Server Error). All other endpoints working perfectly. No regressions detected."
    - agent: "user"
      message: "Quick focused re-test of ONLY the 2FA setup endpoint that failed previously. Task: Log in as admin (admin@aurelawallet.com / Aurela@123#), then call POST /api/profile/2fa/setup with empty body. Expected: 200 OK with JSON { secret: <string>, uri: <string starting with otpauth://totp/...>, qr_svg: <string starting with '<svg'> }. MUST NOT return 500 Internal Server Error. I fixed the otplib v13+ API mismatch: replaced authenticator.generateSecret() with otp.generateSecret(), and authenticator.check() with otp.verifySync({secret, token, window:1}). Also applied same fix to /profile/2fa/enable, /profile/2fa/disable, and the 2FA verification during /auth/login. Just verify the 2FA setup endpoint returns 200 with the correct shape."
    - agent: "testing"
      message: "✅ 2FA SETUP ENDPOINT RE-TEST COMPLETE - PASSED! Focused re-test of POST /api/profile/2fa/setup completed successfully. (1) Admin login (admin@aurelawallet.com / Aurela@123#) → 200 with token and role=super_admin ✅ (2) POST /api/profile/2fa/setup with empty body → 200 OK ✅ (3) Response structure validated: secret is 32-char string ✅, uri starts with 'otpauth://totp/' ✅, qr_svg starts with '<svg' ✅. Fix confirmed working: otplib v13 functional API (otp.generateSecret() and otp.verifySync()) is now correctly used. No 500 errors. The 2FA setup endpoint is fully functional."

