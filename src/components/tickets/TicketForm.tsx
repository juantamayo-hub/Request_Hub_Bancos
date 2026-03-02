'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Category, TicketPriority } from '@/lib/database.types'

// ─── Types ────────────────────────────────────────────────────

type Step =
  | 'support_type'
  | 'document_type'
  | 'noc_travel'
  | 'salary_cert'
  | 'payslips'
  | 'other_letter'
  | 'parking_action'
  | 'parking_addition'
  | 'parking_cancellation'
  | 'health_insurance'
  | 'visa'
  | 'time_off'
  | 'revolut'
  | 'other_support'
  | 'urgency'

interface FormState {
  supportType: string
  // Documents
  documentType: string
  nocEmbassy: string
  nocTravelDates: string
  nocOtherRequirements: string
  nocFormat: string
  salaryCertAddressedTo: string
  salaryCertSpecialRequirements: string
  salaryCertFormat: string
  payslipMonths: string
  otherLetterType: string
  otherLetterFormat: string
  // Parking
  parkingAction: string
  parkingAgreement: boolean
  parkingCarDetails: string
  parkingCancellationDate: string
  // Other categories
  healthInsuranceHelp: string
  visaHelp: string
  timeOffHelp: string
  revolutHelp: string
  otherHelp: string
  // Final step
  urgency: string
}

const INITIAL_FORM: FormState = {
  supportType: '',
  documentType: '',
  nocEmbassy: '',
  nocTravelDates: '',
  nocOtherRequirements: '',
  nocFormat: '',
  salaryCertAddressedTo: '',
  salaryCertSpecialRequirements: '',
  salaryCertFormat: '',
  payslipMonths: '',
  otherLetterType: '',
  otherLetterFormat: '',
  parkingAction: '',
  parkingAgreement: false,
  parkingCarDetails: '',
  parkingCancellationDate: '',
  healthInsuranceHelp: '',
  visaHelp: '',
  timeOffHelp: '',
  revolutHelp: '',
  otherHelp: '',
  urgency: '',
}

// ─── Step metadata ────────────────────────────────────────────

const STEP_INFO: Record<Step, { title: string; description?: string }> = {
  support_type: { title: 'What kind of support do you need?' },
  document_type: { title: 'Specify the type of document' },
  noc_travel: { title: 'NOC for Travel' },
  salary_cert: { title: 'Salary Certificate' },
  payslips: {
    title: 'Payslips',
    description:
      'Payslips from February 2024 to date are available directly at Cercli (app.cercli.com) under the Payments tab. You can download them there without needing to raise a ticket.',
  },
  other_letter: { title: 'Other Letter and Documents' },
  parking_action: {
    title: 'Parking',
    description:
      'Parking is subsidized by Huspy at 30%, bringing the monthly cost to AED 390. Partial month payments are not allowed — once you apply, the full monthly amount will be charged.\n\nFor agents: payment via bank transfer or Mamopay. For non-agents: deducted from monthly payroll.',
  },
  parking_addition: {
    title: 'Parking Addition / Change',
    description:
      'Monthly cost: AED 390 (30% subsidized by Huspy). No partial month payments.\n\nTo opt out, please inform the People Team before the 27th of each month.',
  },
  parking_cancellation: {
    title: 'Parking — Cancellation',
    description:
      'To avoid being charged for the following month, you must request cancellation before the 27th of the current month.',
  },
  health_insurance: {
    title: 'Health Insurance',
    description: 'Reminder: to check your network, download the "MyNas" app and sign in using your Emirates ID details.',
  },
  visa: { title: 'Visa' },
  time_off: { title: 'Time-Off' },
  revolut: { title: 'Revolut Adjustments', description: 'Update of any personal or job information.' },
  other_support: { title: 'Other Support' },
  urgency: { title: "What's the urgency?" },
}

// ─── Navigation logic ─────────────────────────────────────────

function getNextStep(step: Step, form: FormState): Step {
  switch (step) {
    case 'support_type':
      switch (form.supportType) {
        case 'documents':        return 'document_type'
        case 'parking':          return 'parking_action'
        case 'health_insurance': return 'health_insurance'
        case 'visa':             return 'visa'
        case 'time_off':         return 'time_off'
        case 'revolut':          return 'revolut'
        default:                 return 'other_support'
      }
    case 'document_type':
      switch (form.documentType) {
        case 'noc_travel':          return 'noc_travel'
        case 'salary_certificate':  return 'salary_cert'
        case 'payslips':            return 'payslips'
        default:                    return 'other_letter' // noc_golden_visa | employment_letter | other
      }
    case 'parking_action':
      return form.parkingAction === 'remove' ? 'parking_cancellation' : 'parking_addition'
    default:
      return 'urgency'
  }
}

function validateStep(step: Step, form: FormState): string | null {
  switch (step) {
    case 'support_type':
      return form.supportType ? null : 'Please select a support type.'
    case 'document_type':
      return form.documentType ? null : 'Please select a document type.'
    case 'noc_travel':
      if (!form.nocEmbassy.trim())    return 'Please enter the embassy name.'
      if (!form.nocTravelDates.trim()) return 'Please enter the expected travel dates.'
      if (!form.nocFormat)             return 'Please select the document format.'
      return null
    case 'salary_cert':
      if (!form.salaryCertAddressedTo.trim()) return 'Please specify who this should be addressed to.'
      if (!form.salaryCertFormat)             return 'Please select the document format.'
      return null
    case 'payslips':
      return null // field is optional
    case 'other_letter':
      // For "Other" type, the document description is required
      if (form.documentType === 'other' && !form.otherLetterType.trim())
        return 'Please specify the type of document needed.'
      if (!form.otherLetterFormat) return 'Please select the document format.'
      return null
    case 'parking_action':
      return form.parkingAction ? null : 'Please select how we can help with parking.'
    case 'parking_addition':
      if (!form.parkingAgreement)          return 'Please confirm you agree to the parking terms.'
      if (!form.parkingCarDetails.trim())  return 'Please provide your car model and plate number.'
      return null
    case 'parking_cancellation':
      if (!form.parkingCancellationDate.trim()) return 'Please provide the desired cancellation date.'
      if (!form.parkingCarDetails.trim())        return 'Please provide your car model and plate number.'
      return null
    case 'health_insurance':
      return form.healthInsuranceHelp.trim() ? null : 'Please describe how we can help.'
    case 'visa':
      return form.visaHelp.trim() ? null : 'Please describe how we can help.'
    case 'time_off':
      return form.timeOffHelp.trim() ? null : 'Please describe how we can help.'
    case 'revolut':
      return form.revolutHelp.trim() ? null : 'Please describe how we can help.'
    case 'other_support':
      return form.otherHelp.trim() ? null : 'Please describe how we can help.'
    case 'urgency':
      return form.urgency ? null : 'Please select the urgency level.'
    default:
      return null
  }
}

// ─── Payload builder ──────────────────────────────────────────

function fmtLabel(f: string): string {
  if (f === 'digitally') return 'Digitally'
  if (f === 'printed')   return 'Printed'
  if (f === 'both')      return 'Both (printed & digital)'
  return f
}

function buildTicketPayload(
  form: FormState,
  categories: Pick<Category, 'id' | 'name'>[],
): { category_id: string; subcategory: string; subject: string; description: string; priority: TicketPriority } {
  const cat = (name: string) =>
    categories.find(c => c.name.toLowerCase() === name.toLowerCase())?.id ??
    categories[0]?.id ?? ''

  let category_id = ''
  let subcategory  = ''
  let subject      = ''
  const lines: string[] = []

  const priority: TicketPriority =
    form.urgency === 'urgent'     ? 'high'   :
    form.urgency === 'not_urgent' ? 'low'    : 'medium'

  switch (form.supportType) {
    case 'documents': {
      category_id = cat('HR')
      switch (form.documentType) {
        case 'noc_travel':
          subcategory = 'NOC for Travel'
          subject     = `NOC for Travel — ${form.nocEmbassy} Embassy`
          lines.push(`Embassy: ${form.nocEmbassy}`)
          lines.push(`Expected travel dates: ${form.nocTravelDates}`)
          if (form.nocOtherRequirements) lines.push(`Other requirements: ${form.nocOtherRequirements}`)
          lines.push(`Format: ${fmtLabel(form.nocFormat)}`)
          break
        case 'noc_golden_visa':
          subcategory = 'NOC for Golden Visa'
          subject     = 'NOC for Golden Visa'
          if (form.otherLetterType) lines.push(`Additional details: ${form.otherLetterType}`)
          lines.push(`Format: ${fmtLabel(form.otherLetterFormat)}`)
          break
        case 'employment_letter':
          subcategory = 'Employment Letter'
          subject     = 'Employment Letter Request'
          if (form.otherLetterType) lines.push(`Specifications: ${form.otherLetterType}`)
          lines.push(`Format: ${fmtLabel(form.otherLetterFormat)}`)
          break
        case 'salary_certificate':
          subcategory = 'Salary Certificate'
          subject     = `Salary Certificate — ${form.salaryCertAddressedTo}`
          lines.push(`Addressed to: ${form.salaryCertAddressedTo}`)
          if (form.salaryCertSpecialRequirements) lines.push(`Special requirements: ${form.salaryCertSpecialRequirements}`)
          lines.push(`Format: ${fmtLabel(form.salaryCertFormat)}`)
          break
        case 'payslips':
          subcategory = 'Payslips'
          subject     = 'Payslip Request'
          if (form.payslipMonths) lines.push(`Months needed: ${form.payslipMonths}`)
          lines.push('Note: payslips from Feb 2024 onwards are available at Cercli (app.cercli.com) → Payments tab.')
          break
        default:
          subcategory = 'Other Document'
          subject     = `Document Request: ${form.otherLetterType}`
          lines.push(`Document type: ${form.otherLetterType}`)
          lines.push(`Format: ${fmtLabel(form.otherLetterFormat)}`)
      }
      break
    }

    case 'parking': {
      category_id = cat('Parking')
      if (form.parkingAction === 'remove') {
        subcategory = 'Parking Cancellation'
        subject     = 'Parking Cancellation Request'
        lines.push(`Requested end date: ${form.parkingCancellationDate}`)
        lines.push(`Car model & plate: ${form.parkingCarDetails}`)
        lines.push('Note: Emirates ID and Vehicle Registration / Rental Agreement will be shared separately.')
      } else {
        const isUpdate = form.parkingAction === 'update'
        subcategory = isUpdate ? 'Parking Update'       : 'Parking Application'
        subject     = isUpdate ? 'Parking Details Update' : 'Parking Application'
        lines.push(`Action: ${isUpdate ? 'Update parking details' : 'Apply for parking'}`)
        lines.push(`Car model & plate: ${form.parkingCarDetails}`)
        lines.push('Monthly cost: AED 390 (30% subsidized by Huspy). No partial month payments.')
      }
      break
    }

    case 'health_insurance':
      category_id = cat('HR')
      subcategory = 'Health Insurance'
      subject     = 'Health Insurance Enquiry'
      lines.push(form.healthInsuranceHelp)
      break

    case 'visa':
      category_id = cat('HR')
      subcategory = 'Visa'
      subject     = 'Visa Support Request'
      lines.push(form.visaHelp)
      break

    case 'time_off':
      category_id = cat('HR')
      subcategory = 'Time-Off'
      subject     = 'Time-Off Request'
      lines.push(form.timeOffHelp)
      break

    case 'revolut':
      category_id = cat('HR')
      subcategory = 'Revolut Adjustment'
      subject     = 'Revolut Adjustment Request'
      lines.push(form.revolutHelp)
      break

    default: // other
      category_id = cat('General')
      subcategory = 'Other'
      subject     = 'Support Request'
      lines.push(form.otherHelp)
  }

  return { category_id, subcategory, subject, description: lines.filter(Boolean).join('\n'), priority }
}

// ─── RadioGroup helper ────────────────────────────────────────

interface RadioOption { value: string; label: string; description?: string }

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: RadioOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            value === opt.value
              ? 'border-gray-900 bg-gray-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-gray-900 shrink-0"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            {opt.description && (
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────

interface Props {
  categories: Pick<Category, 'id' | 'name'>[]
}

export function TicketForm({ categories }: Props) {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [step,    setStep]    = useState<Step>('support_type')
  const [history, setHistory] = useState<Step[]>([])
  const [form,    setForm]    = useState<FormState>(INITIAL_FORM)

  // Generic state setters
  const setStr = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))

  const setVal = (key: keyof FormState) => (value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }))

  // ─── Navigation ─────────────────────────────────────────────

  const goNext = () => {
    const error = validateStep(step, form)
    if (error) { toast.error(error); return }

    if (step === 'urgency') {
      submitTicket()
      return
    }

    const next = getNextStep(step, form)
    setHistory(h => [...h, step])
    setStep(next)
  }

  const goBack = () => {
    if (history.length === 0) return
    setStep(history[history.length - 1])
    setHistory(h => h.slice(0, -1))
  }

  // ─── Submission ──────────────────────────────────────────────

  const submitTicket = async () => {
    const payload = buildTicketPayload(form, categories)
    if (!payload.category_id) {
      toast.error('Could not determine category. Please contact support.')
      return
    }

    setLoading(true)
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 25_000)

    try {
      const res = await fetch('/api/tickets', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(payload),
        credentials: 'include',
        signal:      controller.signal,
      })
      clearTimeout(timeoutId)

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create ticket.')
        return
      }

      toast.success(`Ticket ${data.ticket.display_id} created!`)
      router.push(`/tickets/${data.ticket.id}`)
      router.refresh()
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        toast.error('Request timed out. Check your connection and try again.')
      } else {
        toast.error('Connection error. Check your network and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Render helpers ──────────────────────────────────────────

  const FORMAT_OPTIONS: RadioOption[] = [
    { value: 'digitally', label: 'Digitally' },
    { value: 'printed',   label: 'Printed' },
    { value: 'both',      label: 'Both' },
  ]
  const FORMAT_NO_BOTH = FORMAT_OPTIONS.filter(o => o.value !== 'both')

  const info = STEP_INFO[step]

  return (
    <div className="card p-6 space-y-6">

      {/* Step header */}
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
          Step {history.length + 1}
        </p>
        <h2 className="text-base font-semibold text-gray-900">{info.title}</h2>
        {info.description && (
          <p className="mt-1.5 text-sm text-gray-500 whitespace-pre-line">{info.description}</p>
        )}
      </div>

      {/* ── Step: Support type ── */}
      {step === 'support_type' && (
        <RadioGroup
          name="supportType"
          value={form.supportType}
          onChange={setVal('supportType')}
          options={[
            { value: 'documents',        label: 'Documents',          description: 'Salary Certificate, Payslip, NOCs, Labor Card and letters of any kind' },
            { value: 'visa',             label: 'Visa' },
            { value: 'health_insurance', label: 'Health Insurance' },
            { value: 'parking',          label: 'Parking',            description: 'Apply, remove or update car' },
            { value: 'time_off',         label: 'Time-Off',           description: 'Vacation adjustments and other leaves' },
            { value: 'revolut',          label: 'Revolut Adjustments' },
            { value: 'other',            label: 'Other' },
          ]}
        />
      )}

      {/* ── Step: Document type ── */}
      {step === 'document_type' && (
        <RadioGroup
          name="documentType"
          value={form.documentType}
          onChange={setVal('documentType')}
          options={[
            { value: 'noc_travel',         label: 'NOC for Travel' },
            { value: 'noc_golden_visa',    label: 'NOC for Golden Visa' },
            { value: 'employment_letter',  label: 'Employment Letter' },
            { value: 'salary_certificate', label: 'Salary Certificate' },
            { value: 'payslips',           label: 'Payslips' },
            { value: 'other',              label: 'Other' },
          ]}
        />
      )}

      {/* ── Step: NOC for Travel ── */}
      {step === 'noc_travel' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="nocEmbassy">To which embassy should the letter be addressed to? *</Label>
            <Input
              id="nocEmbassy"
              placeholder="e.g. Embassy of Spain"
              value={form.nocEmbassy}
              onChange={setStr('nocEmbassy')}
            />
          </div>
          <div>
            <Label htmlFor="nocTravelDates">What are the expected travel dates? *</Label>
            <Input
              id="nocTravelDates"
              placeholder="e.g. 10 Mar 2026 – 20 Mar 2026"
              value={form.nocTravelDates}
              onChange={setStr('nocTravelDates')}
            />
          </div>
          <div>
            <Label htmlFor="nocOtherRequirements">
              Any other requirements? (salary certificate, MOL Contract, etc.)
              {' '}<span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="nocOtherRequirements"
              placeholder="e.g. Please also include a salary certificate"
              rows={3}
              value={form.nocOtherRequirements}
              onChange={setStr('nocOtherRequirements')}
            />
          </div>
          <div>
            <Label className="mb-2">Do you need this document printed or digitally? *</Label>
            <RadioGroup
              name="nocFormat"
              value={form.nocFormat}
              onChange={setVal('nocFormat')}
              options={FORMAT_OPTIONS}
            />
          </div>
        </div>
      )}

      {/* ── Step: Salary Certificate ── */}
      {step === 'salary_cert' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="salaryCertAddressedTo">Who should this letter be addressed to? *</Label>
            <Input
              id="salaryCertAddressedTo"
              placeholder="e.g. Dubai Islamic Bank, Embassy of France"
              value={form.salaryCertAddressedTo}
              onChange={setStr('salaryCertAddressedTo')}
            />
          </div>
          <div>
            <Label htmlFor="salaryCertSpecialRequirements">
              Is there any other specific requirement?
              {' '}<span className="text-gray-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="salaryCertSpecialRequirements"
              placeholder="Any special wording or additional details"
              rows={3}
              value={form.salaryCertSpecialRequirements}
              onChange={setStr('salaryCertSpecialRequirements')}
            />
          </div>
          <div>
            <Label className="mb-2">Do you need this document printed or digitally? *</Label>
            <RadioGroup
              name="salaryCertFormat"
              value={form.salaryCertFormat}
              onChange={setVal('salaryCertFormat')}
              options={FORMAT_OPTIONS}
            />
          </div>
        </div>
      )}

      {/* ── Step: Payslips ── */}
      {step === 'payslips' && (
        <div>
          <Label htmlFor="payslipMonths">
            Which months&apos; payslips do you need?
            {' '}<span className="text-gray-400 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="payslipMonths"
            placeholder="e.g. January 2025, February 2025"
            rows={3}
            value={form.payslipMonths}
            onChange={setStr('payslipMonths')}
          />
        </div>
      )}

      {/* ── Step: Other Letter / Employment Letter / NOC Golden Visa ── */}
      {step === 'other_letter' && (
        <div className="space-y-4">
          {form.documentType !== 'other' && (
            <p className="text-sm text-gray-500">
              Document type:{' '}
              <strong>
                {form.documentType === 'noc_golden_visa'   ? 'NOC for Golden Visa' :
                 form.documentType === 'employment_letter' ? 'Employment Letter'   : ''}
              </strong>
            </p>
          )}
          <div>
            <Label htmlFor="otherLetterType">
              {form.documentType === 'other'
                ? 'Please specify the type of document you need *'
                : 'Any additional specifications?'}
            </Label>
            <Textarea
              id="otherLetterType"
              placeholder={
                form.documentType === 'other'
                  ? 'Describe the document you need'
                  : 'Any specific requirements or details (optional)'
              }
              rows={3}
              value={form.otherLetterType}
              onChange={setStr('otherLetterType')}
            />
          </div>
          <div>
            <Label className="mb-2">Do you need this document printed or digitally? *</Label>
            <RadioGroup
              name="otherLetterFormat"
              value={form.otherLetterFormat}
              onChange={setVal('otherLetterFormat')}
              options={FORMAT_NO_BOTH}
            />
          </div>
        </div>
      )}

      {/* ── Step: Parking action ── */}
      {step === 'parking_action' && (
        <RadioGroup
          name="parkingAction"
          value={form.parkingAction}
          onChange={setVal('parkingAction')}
          options={[
            { value: 'apply',  label: 'I need to apply for Parking' },
            { value: 'remove', label: 'I need to remove my car from parking' },
            { value: 'update', label: 'I need to update my parking details' },
          ]}
        />
      )}

      {/* ── Step: Parking Addition / Change ── */}
      {step === 'parking_addition' && (
        <div className="space-y-4">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50/50">
            <input
              type="checkbox"
              checked={form.parkingAgreement}
              onChange={e => setVal('parkingAgreement')(e.target.checked)}
              className="mt-0.5 accent-gray-900 shrink-0"
            />
            <span className="text-sm text-gray-900">
              I agree and confirm the parking terms *
            </span>
          </label>
          <div>
            <Label htmlFor="parkingCarDetails">What&apos;s your car model and car plate? *</Label>
            <Input
              id="parkingCarDetails"
              placeholder="e.g. Toyota Corolla — ABC 1234"
              value={form.parkingCarDetails}
              onChange={setStr('parkingCarDetails')}
            />
          </div>
        </div>
      )}

      {/* ── Step: Parking Cancellation ── */}
      {step === 'parking_cancellation' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="parkingCancellationDate">
              What date would you like your parking subscription to end? *
            </Label>
            <Input
              id="parkingCancellationDate"
              type="date"
              value={form.parkingCancellationDate}
              onChange={setStr('parkingCancellationDate')}
            />
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <strong>Required documents:</strong> After submitting this ticket, please send your{' '}
            <strong>Emirates ID</strong> and{' '}
            <strong>Vehicle Registration or Vehicle Rental Agreement</strong> to the People Team
            via email or Slack.
          </div>
          <div>
            <Label htmlFor="parkingCarDetails">What&apos;s your car model and car plate? *</Label>
            <Input
              id="parkingCarDetails"
              placeholder="e.g. Toyota Corolla — ABC 1234"
              value={form.parkingCarDetails}
              onChange={setStr('parkingCarDetails')}
            />
          </div>
        </div>
      )}

      {/* ── Step: Health Insurance ── */}
      {step === 'health_insurance' && (
        <div>
          <Label htmlFor="healthInsuranceHelp">How can we help you? *</Label>
          <Textarea
            id="healthInsuranceHelp"
            placeholder="Describe your health insurance query or issue"
            rows={4}
            value={form.healthInsuranceHelp}
            onChange={setStr('healthInsuranceHelp')}
          />
        </div>
      )}

      {/* ── Step: Visa ── */}
      {step === 'visa' && (
        <div>
          <Label htmlFor="visaHelp">How can we help you? *</Label>
          <Textarea
            id="visaHelp"
            placeholder="Describe your visa-related request"
            rows={4}
            value={form.visaHelp}
            onChange={setStr('visaHelp')}
          />
        </div>
      )}

      {/* ── Step: Time-Off ── */}
      {step === 'time_off' && (
        <div>
          <Label htmlFor="timeOffHelp">How can we help you? *</Label>
          <Textarea
            id="timeOffHelp"
            placeholder="Describe your time-off request, vacation adjustment or other leave"
            rows={4}
            value={form.timeOffHelp}
            onChange={setStr('timeOffHelp')}
          />
        </div>
      )}

      {/* ── Step: Revolut ── */}
      {step === 'revolut' && (
        <div>
          <Label htmlFor="revolutHelp">How can we help you? *</Label>
          <Textarea
            id="revolutHelp"
            placeholder="Describe what needs to be updated on Revolut"
            rows={4}
            value={form.revolutHelp}
            onChange={setStr('revolutHelp')}
          />
        </div>
      )}

      {/* ── Step: Other Support ── */}
      {step === 'other_support' && (
        <div>
          <Label htmlFor="otherHelp">How can we help you? *</Label>
          <Textarea
            id="otherHelp"
            placeholder="Describe your request or issue"
            rows={4}
            value={form.otherHelp}
            onChange={setStr('otherHelp')}
          />
        </div>
      )}

      {/* ── Step: Urgency ── */}
      {step === 'urgency' && (
        <RadioGroup
          name="urgency"
          value={form.urgency}
          onChange={setVal('urgency')}
          options={[
            { value: 'urgent',     label: "I'd get in trouble if I don't get it today", description: '2–4 hours' },
            { value: 'tomorrow',   label: 'I can wait until tomorrow',                  description: 'Up to 24 hours' },
            { value: 'not_urgent', label: "It's not urgent",                            description: 'Up to 48 hours' },
          ]}
        />
      )}

      {/* ── Navigation buttons ── */}
      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        {step === 'urgency' ? (
          <Button type="button" isLoading={loading} onClick={goNext}>
            Submit Ticket
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Next
          </Button>
        )}

        {history.length > 0 ? (
          <Button type="button" variant="ghost" onClick={goBack} disabled={loading}>
            Back
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
