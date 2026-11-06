import type { DateRange } from './service'

export function downloadHistory(csv: Blob, range: DateRange): void {
  const url = URL.createObjectURL(csv)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = `tasko-sessions_${range.start ?? 'all'}_${range.end ?? 'latest'}.csv`
    document.body.append(link)
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
