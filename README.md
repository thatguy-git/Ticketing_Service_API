Microservice API designed to interact with the bank ledger API to allow users with an account from the bank ledger api buy tickets for events created by admin.
Service flow
1. Admin/organizer creates event, payment invoice is also created with the admin/organizer's API key.
2. User books seat, seat is held for 15 minutes to allow user enough time to complete payment.
3. User receives an invoice ID to be used for payment.
4. User sends the invoice ID along with their transaction pin in the banking ledger's endpoint to handle invoice payments.
5. Bank tries to charge user with the details obtained from the invoice ID, if successful the bank sends a success webhook to the ticketing service API which then updates the seat's
   status in the database and then creates a ticket pdf and sends to the users email address, if not the transaction is marked failed and if the user can't resolve the paymment issue
   in 15 minutes the reserved seat is freed for other users.

Simple but secure.
