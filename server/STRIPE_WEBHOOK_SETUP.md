# Stripe Webhook Local Development Guide

This guide explains how to set up and test Stripe Webhooks locally using the Stripe CLI.

## Prerequisites

1.  **Install Stripe CLI**:

    - **Windows (via Chocolatey)**: `choco install stripe-cli`
    - **Mac (via Homebrew)**: `brew install stripe/stripe-cli/stripe`
    - **Manual**: Download from [Stripe CLI docs](https://docs.stripe.com/stripe-cli).

2.  **Login**:
    Run the following command and follow the browser prompts to link the CLI to your Stripe account:
    ```bash
    stripe login
    ```

## Step 1: Start the Webhook Listener

Run the following command in your terminal to forward Stripe events to your local backend.

**Command:**

```powershell
stripe listen --forward-to localhost:3000/api/payments/webhook/stripe
```

_> **Note:** If your server is running on a different port than 3000, replace `3000` with your actual port number._

## Step 2: Configure Webhook Secret

When you run the command above, you will see output like this:

```text
> Ready! You are using Stripe API Version [2022-11-15]. Your webhook signing secret is whsec_...
```

1.  Copy the **signing secret** (starting with `whsec_`).
2.  Open your `server/.env` file.
3.  Update (or add) the `STRIPE_WEBHOOK_SECRET` variable:

```env
STRIPE_WEBHOOK_SECRET=whsec_your_secret_key_here
```

4.  **Restart your backend server** to load the new environment variable.

## Step 3: Trigger Test Events

You can now trigger test events to verify the integration.

**Test Winning Payment (Contract Generation):**

```powershell
stripe trigger checkout.session.completed --add "checkout_session:metadata[paymentType]=winning_payment" --add "checkout_session:metadata[auctionId]=uuid-of-your-auction"
```

**Test Deposit Payment:**

```powershell
stripe trigger checkout.session.completed --add "checkout_session:metadata[paymentType]=deposit" --add "checkout_session:metadata[registrationId]=uuid-of-registration" --add "checkout_session:metadata[userId]=uuid-of-user"
```

## Step 4: Verify Success

1.  Check your backend terminal logs. You should see:
    ```text
    [PaymentWebhookController] Received Stripe Webhook Event: checkout.session.completed
    [PaymentWebhookController] Processing winning_payment webhook...
    ```
2.  Check the Stripe CLI terminal. You should see:
    ```text
    200 OK <-- [200] POST http://localhost:3000/api/payments/webhook/stripe
    ```
