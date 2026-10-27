/**
 * Payment Failure Page — Redirects to billing page with failure parameter
 * so the floating failure component on the billing page handles the UI.
 */
import { redirect } from 'next/navigation'

export default function PaymentFailurePage() {
  redirect('/billing?failure=true')
}
