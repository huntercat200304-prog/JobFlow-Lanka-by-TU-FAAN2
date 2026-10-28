import { useEffect, useState } from 'react'
import { supabase, Job } from '../lib/supabase'
import { useAuth } from '../App'

export default function MyJobs() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user) return
    supabase
      .from('jobs')
      .select('*')
      .eq('posted_by', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setJobs((data as Job[]) || [])
        setLoading(false)
      })
  }, [user])

  async function remove(id: number) {
    if (!user) return
    if (!confirm('Delete this job permanently?')) return
    setErr('')
    setMsg('')
    // Only own posts — double safety with posted_by filter
    const { error, count } = await supabase
      .from('jobs')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('posted_by', user.id)

    if (error) {
      setErr(error.message || 'Delete failed')
      return
    }
    if (count === 0) {
      setErr('Delete failed — not your job or permission denied')
      return
    }
    setJobs(j => j.filter(x => x.id !== id))
    setMsg('Job deleted')
    setTimeout(() => setMsg(''), 2000)
  }

  if (loading) return <div className="empty">Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: '1.3rem', marginBottom: 14 }}>My Jobs</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 12 }}>
        ඔයා post කරපු jobs විතරක්. Delete කළොත් ආයේ ගන්න බැහැ.
      </p>
      {msg && <div className="msg ok">{msg}</div>}
      {err && <div className="msg err">{err}</div>}
      {jobs.length === 0 ? (
        <div className="empty">ඔයා post කරපු jobs නැහැ</div>
      ) : (
        <div className="grid">
          {jobs.map(job => (
            <div key={job.id} className="job-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--accent)' }}>{job.title || 'Job'}</strong>
                <span className="pill">{job.status}</span>
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--muted)', margin: '8px 0', whiteSpace: 'pre-wrap' }}>
                {job.description}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8 }}>
                {job.city ? `📍 ${job.city}` : ''}{job.work_date ? ` · ${job.work_date}` : ''}
                {job.employment_type ? ` · ${job.employment_type}` : ''}
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => remove(job.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
