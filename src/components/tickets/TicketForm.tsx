'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { TICKET_PRIORITIES } from '@/lib/constants'
import type { Category } from '@/lib/database.types'

interface Props {
  categories: Pick<Category, 'id' | 'name'>[]
}

export function TicketForm({ categories }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    category_id:  '',
    subcategory:  '',
    subject:      '',
    description:  '',
    priority:     'medium' as const,
  })

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.category_id) { toast.error('Please select a category.'); return }
    if (!form.subject.trim()) { toast.error('Subject is required.'); return }
    if (!form.description.trim()) { toast.error('Description is required.'); return }

    setLoading(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25_000) // 25s timeout
    try {
      const res = await fetch('/api/tickets', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(form),
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
      const isAbort = err instanceof Error && err.name === 'AbortError'
      if (isAbort) {
        toast.error('Request timed out. Check your connection and try again.')
      } else {
        toast.error('Connection error. Check your network and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }))
  const priorityOptions = TICKET_PRIORITIES.map(p => ({ value: p.value, label: p.label }))

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      {/* Category */}
      <div>
        <Label htmlFor="category">Category *</Label>
        <Select
          id="category"
          placeholder="Select a category"
          options={categoryOptions}
          value={form.category_id}
          onChange={set('category_id')}
          required
        />
      </div>

      {/* Subcategory */}
      <div>
        <Label htmlFor="subcategory">Subcategory <span className="text-gray-400 font-normal">(optional)</span></Label>
        <Input
          id="subcategory"
          placeholder="e.g. VPN access, Payslip query…"
          value={form.subcategory}
          onChange={set('subcategory')}
        />
      </div>

      {/* Subject */}
      <div>
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          placeholder="One-line summary of your request"
          value={form.subject}
          onChange={set('subject')}
          required
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="Describe your issue in detail. Include any relevant context, error messages, or screenshots."
          rows={6}
          value={form.description}
          onChange={set('description')}
          required
        />
      </div>

      {/* Priority */}
      <div>
        <Label htmlFor="priority">Priority</Label>
        <Select
          id="priority"
          options={priorityOptions}
          value={form.priority}
          onChange={set('priority')}
        />
        <p className="text-xs text-gray-400 mt-1">
          The team may adjust priority based on capacity and impact.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" isLoading={loading}>
          Submit Ticket
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
