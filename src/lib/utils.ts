import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Profile } from './database.types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function displayName(profile: Pick<Profile, 'first_name' | 'last_name' | 'email'> | null): string {
  if (!profile) return 'Unknown'
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return name || profile.email
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function formatDateShort(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(iso))
}

export function isSlaBreaching(slaDeadline: string | null): boolean {
  if (!slaDeadline) return false
  return new Date(slaDeadline) < new Date()
}

export function slaHoursRemaining(slaDeadline: string | null): number | null {
  if (!slaDeadline) return null
  return (new Date(slaDeadline).getTime() - Date.now()) / 1000 / 60 / 60
}
