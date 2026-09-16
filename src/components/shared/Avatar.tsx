import Image from 'next/image'
import { cn } from '@/lib/utils'

const SIZES = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-6 h-6 text-xs',
  md: 'w-7 h-7 text-xs',
  lg: 'w-8 h-8 text-sm',
} as const

interface Props {
  name?: string | null
  email?: string
  avatarUrl?: string | null
  size?: keyof typeof SIZES
  className?: string
}

export function Avatar({ name, email, avatarUrl, size = 'md', className }: Props) {
  const initial = (name?.[0] ?? email?.[0] ?? '?').toUpperCase()
  const sizeClass = SIZES[size]

  if (avatarUrl) {
    const px = size === 'xs' ? 20 : size === 'sm' ? 24 : size === 'md' ? 28 : 32
    return (
      <Image
        src={avatarUrl}
        alt={name ?? ''}
        width={px}
        height={px}
        className={cn('rounded-full object-cover', sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        'rounded-full bg-[#E8F2EC] flex items-center justify-center font-medium text-[#083D20] shrink-0',
        sizeClass,
        className,
      )}
    >
      {initial}
    </div>
  )
}
