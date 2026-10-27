/**
 * Payment Success Page — Redirects to billing page with success parameter
 * so the billing page's success banner handles the UI.
 */
import { redirect } from 'next/navigation'

export default function PaymentSuccessPage() {
  redirect('/billing?success=true')
}
