import Image from 'next/image'
import { formatDate, displayName } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { TicketCommentWithAuthor } from '@/lib/database.types'

interface Props {
  comments:         TicketCommentWithAuthor[]
  currentProfileId: string
  isAdmin?:         boolean
}

function FileIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  )
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CommentThread({ comments, currentProfileId, isAdmin = false }: Props) {
  if (comments.length === 0) {
    return <p className="text-sm text-gray-400 py-4">No comments yet.</p>
  }

  return (
    <ol className="space-y-4">
      {comments.map(comment => {
        const isMine     = comment.author_id === currentProfileId
        const isInternal = comment.visibility === 'internal'
        const attachments = comment.attachments ?? []

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

            {/* Attachments */}
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-1">
                {attachments.map(att => (
                  <li key={att.id}>
                    <a
                      href={att.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={att.file_name}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <FileIcon />
                      <span>{att.file_name}</span>
                      <span className="text-gray-400">({formatBytes(att.file_size)})</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
