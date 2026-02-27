import Image from 'next/image'
import { formatDate, displayName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { TicketCommentWithAuthor } from '@/lib/database.types'

interface Props {
  comments:         TicketCommentWithAuthor[]
  currentProfileId: string
  isAdmin?:         boolean
}

export function CommentThread({ comments, currentProfileId, isAdmin = false }: Props) {
  if (comments.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No comments yet.</p>
  }

  return (
    <ol className="space-y-4">
      {comments.map(comment => {
        const isMine    = comment.author_id === currentProfileId
        const isInternal = comment.visibility === 'internal'

        return (
          <li
            key={comment.id}
            className={cn(
              'rounded-lg p-4 text-sm',
              isInternal
                ? 'bg-amber-50 border border-amber-200'
                : 'bg-gray-50 border border-gray-100',
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              {comment.profiles.avatar_url ? (
                <Image
                  src={comment.profiles.avatar_url}
                  alt=""
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                  {(comment.profiles.first_name?.[0] ?? comment.profiles.email[0]).toUpperCase()}
                </div>
              )}

              <span className="font-medium text-gray-800">
                {displayName(comment.profiles)}
                {isMine && <span className="text-gray-400 font-normal"> (you)</span>}
              </span>

              <span className="text-gray-400">·</span>
              <time className="text-gray-400 text-xs">{formatDate(comment.created_at)}</time>

              {isAdmin && isInternal && (
                <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                  Internal
                </span>
              )}
            </div>

            {/* Body */}
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
              {comment.body}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
