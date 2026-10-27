import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { extractAll, Extracted } from '../lib/extract'
import { useAuth } from '../App'

type FormFields = {
  title: string
  description: string
  district: string
  city: string
  area: string
  job_type: string
  payment_text: string
  payment_amount: string
  work_date: string
  work_time: string
  contact_name: string
  contact_phone: string
  gender: string
  food_included: boolean
  immediate_hiring: boolean
}

const emptyForm = (): FormFields => ({
  title: '',
  description: '',
  district: '',
  city: '',
  area: '',
  job_type: '',
  payment_text: '',
  payment_amount: '',
  work_date: '',
  work_time: '',
  contact_name: '',
  contact_phone: '',
  gender: '',
  food_included: false,
  immediate_hiring: false,
})

function fromExtracted(ex: Extracted, areaOverride: string): FormFields {
  return {
    title: ex.title || '',
    description: ex.clean || '',
    district: ex.district || '',
    city: ex.location || '',
    area: areaOverride || '',
    job_type: ex.workType || '',
    payment_text: ex.payment || '',
    payment_amount: ex.paymentNum ? String(ex.paymentNum) : '',
    work_date: ex.date || '',
    work_time: ex.time || '',
    contact_name: ex.contactName || '',
    contact_phone: ex.contact || '',
    gender: ex.gender || '',
    food_included: !!ex.food,
    immediate_hiring: !!ex.immediate,
  }
}

export default function PostJob() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const [raw, setRaw] = useState('')
  const [areaManual, setAreaManual] = useState('')
  const [extracted, setExtracted] = useState<Extracted | null>(null)
  const [form, setForm] = useState<FormFields>(emptyForm())
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!raw.trim()) {
      setExtracted(null)
      if (!editing) setForm(emptyForm())
      return
    }
    const t = setTimeout(() => {
      const ex = extractAll(raw)
      setExtracted(ex)
      if (!editing) {
        setForm(fromExtracted(ex, areaManual))
      }
    }, 250)
    return () => clearTimeout(t)
  }, [raw, areaManual, editing])

  // Keep area in form when manual area changes
  useEffect(() => {
    setForm(f => ({ ...f, area: areaManual }))
  }, [areaManual])

  function setField<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setEditing(true)
    setForm(f => ({ ...f, [key]: value }))
  }

  function effectiveLocation(): string {
    return (form.area || form.city || '').trim()
  }

  function missingRequired(): string[] {
    const miss: string[] = []
    if (!effectiveLocation()) miss.push('City / Area')
    if (!form.district.trim() && !form.area.trim()) miss.push('District (or set Area)')
    if (!form.payment_text.trim() && !form.payment_amount.trim()) miss.push('Payment')
    if (!form.contact_phone.trim()) miss.push('Coordinator WhatsApp number')
    return miss
  }

  async function save(employmentType: 'part-time' | 'full-time') {
    if (!user) {
      setErr('Post කරන්න Login වෙන්න')
      return
    }
    if (!raw.trim() && !form.description.trim()) {
      setErr('Message එකක් හෝ description එකක් දාන්න')
      return
    }

    const miss = missingRequired()
    if (miss.length) {
      setErr('⚠️ Required: ' + miss.join(', '))
      return
    }

    if (employmentType === 'part-time' && !form.work_date.trim()) {
      setErr('⚠️ Part-time job එකට work date එකක් ඕනේ')
      return
    }

    setSaving(true)
    setErr('')
    setMsg('')

    if (!profile) {
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email || null,
        role: 'employer',
        full_name: form.contact_name || null,
        phone: form.contact_phone || null,
      })
    }

    const cityVal = (form.area || form.city || '').trim() || null
    const payNum = form.payment_amount ? parseFloat(form.payment_amount) : null

    const { error } = await supabase.from('jobs').insert({
      title: form.title.trim() || form.job_type || 'Job',
      description: form.description.trim() || null,
      description_si: form.description.trim() || null,
      district: form.district.trim() || null,
      city: cityVal,
      job_type: form.job_type.trim() || null,
      employment_type: employmentType,
      immediate_hiring: form.immediate_hiring,
      payment_amount: payNum && !Number.isNaN(payNum) ? payNum : null,
      payment_text: form.payment_text.trim() || (payNum ? `Rs. ${payNum}` : null),
      food_included: form.food_included,
      work_date: form.work_date.trim() || null,
      work_time: form.work_time.trim() || null,
      contact_name: form.contact_name.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      gender: form.gender.trim() || null,
      status: 'new',
      posted_by: user.id,
      raw_text: raw || null,
    })

    setSaving(false)
    if (error) {
      setErr(error.message)
      return
    }
    setMsg(employmentType === 'full-time' ? 'Full-time job saved ✅' : 'Part-time job saved ✅')
    setRaw('')
    setAreaManual('')
    setExtracted(null)
    setForm(emptyForm())
    setEditing(false)
    setTimeout(() => nav('/'), 800)
  }

  function loadExample() {
    setEditing(false)
    setAreaManual('')
    setRaw(`හවස සල්ලි ගන්න කැමති කොල්ලන් ට 
Heta boy 4k
9:30 ta එන්න 
රාජගිරිය boy 4 
Ewalema payment eka denawa 
Helper wedak
Yaluwo 4 k ok
2400+food 
0750900940 maheshika`)
  }

  function clearAll() {
    setRaw('')
    setAreaManual('')
    setExtracted(null)
    setForm(emptyForm())
    setEditing(false)
    setErr('')
    setMsg('')
  }

  const miss = missingRequired()
  const showPreview = !!(raw.trim() || form.description.trim() || extracted)

  return (
    <div>
      <h1 style={{ fontSize: '1.35rem', marginBottom: 12 }}>Post a Job</h1>

      {!user && (
        <div className="msg err">
          Job post කරන්න <a href="/auth" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Login / Sign up</a> වෙන්න.
        </div>
      )}

      <div className="card">
        <label className="label">01 / DRAFT – Rough WhatsApp message</label>
        <textarea
          className="textarea"
          value={raw}
          onChange={e => { setEditing(false); setRaw(e.target.value) }}
          placeholder="Messy job message paste කරන්න..."
        />

        <div style={{ marginTop: 12 }}>
          <label className="label" style={{ color: 'var(--muted)' }}>
            Area / City <span style={{ fontWeight: 400 }}>(optional — extract miss වුණොත් type කරන්න)</span>
          </label>
          <input
            className="input"
            value={areaManual}
            onChange={e => setAreaManual(e.target.value)}
            placeholder="e.g. පිලියන්දල, Kaduwela town…"
          />
        </div>

        <div className="live-bar">
          {(form.area || form.city) && (
            <span className="pill blue">📍 {form.area || form.city}</span>
          )}
          {form.district && <span className="pill">🗺️ {form.district}</span>}
          {form.work_time && <span className="pill">🕘 {form.work_time}</span>}
          {form.payment_text && (
            <span className="pill gold">💰 {form.payment_text}{form.food_included ? ' +කෑම' : ''}</span>
          )}
          {form.work_date && <span className="pill orange">📅 {form.work_date}</span>}
          {form.contact_phone && <span className="pill purple">📞 {form.contact_phone}</span>}
          {form.immediate_hiring && <span className="pill orange">⚡ Immediate</span>}
          {!extracted && !raw.trim() && (
            <span className="pill" style={{ background: 'rgba(148,163,184,0.15)', color: 'var(--muted)' }}>
              Live extract...
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" type="button" onClick={loadExample}>Example</button>
          <button className="btn btn-secondary btn-sm" type="button" onClick={clearAll}>Clear</button>
        </div>
      </div>

      {showPreview && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label className="label" style={{ marginBottom: 0 }}>02 / PREVIEW</label>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditing(e => !e)}
            >
              {editing ? '🔒 Lock' : '✏️ Edit details'}
            </button>
          </div>

          {editing ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <label className="label">Title</label>
                <input className="input" value={form.title} onChange={e => setField('title', e.target.value)} />
              </div>
              <div>
                <label className="label">Description / Summary</label>
                <textarea className="textarea" value={form.description} onChange={e => setField('description', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={form.city} onChange={e => setField('city', e.target.value)} />
                </div>
                <div>
                  <label className="label">Area (optional)</label>
                  <input className="input" value={form.area} onChange={e => { setAreaManual(e.target.value); setField('area', e.target.value) }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">District</label>
                  <input className="input" value={form.district} onChange={e => setField('district', e.target.value)} placeholder="Colombo, Gampaha…" />
                </div>
                <div>
                  <label className="label">Job type</label>
                  <input className="input" value={form.job_type} onChange={e => setField('job_type', e.target.value)} placeholder="Helper, Sales…" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Payment text</label>
                  <input className="input" value={form.payment_text} onChange={e => setField('payment_text', e.target.value)} placeholder="Rs. 2500 + food" />
                </div>
                <div>
                  <label className="label">Payment amount (number)</label>
                  <input className="input" type="number" value={form.payment_amount} onChange={e => setField('payment_amount', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Work date</label>
                  <input className="input" value={form.work_date} onChange={e => setField('work_date', e.target.value)} placeholder="හෙට / 2026-10-28" />
                </div>
                <div>
                  <label className="label">Work time</label>
                  <input className="input" value={form.work_time} onChange={e => setField('work_time', e.target.value)} placeholder="09:00 - 17:00" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label">Contact name</label>
                  <input className="input" value={form.contact_name} onChange={e => setField('contact_name', e.target.value)} />
                </div>
                <div>
                  <label className="label">WhatsApp number *</label>
                  <input className="input" value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} placeholder="07XXXXXXXX" />
                </div>
              </div>
              <div>
                <label className="label">Gender</label>
                <input className="input" value={form.gender} onChange={e => setField('gender', e.target.value)} placeholder="Boys / Girls" />
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.food_included} onChange={e => setField('food_included', e.target.checked)} />
                  Food included
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                  <input type="checkbox" checked={form.immediate_hiring} onChange={e => setField('immediate_hiring', e.target.checked)} />
                  Immediate hiring
                </label>
              </div>
            </div>
          ) : (
            <div className="preview">{form.description || extracted?.clean || '—'}</div>
          )}

          {miss.length > 0 && (
            <div className="msg err" style={{ marginTop: 12 }}>
              ⚠️ Job post කරන්න මේවා අනිවාර්යයි: <strong>{miss.join(', ')}</strong>
            </div>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => save('part-time')}
              disabled={saving || !user || miss.length > 0}
            >
              {saving ? 'Saving...' : '💾 Save as Part-time Job'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => save('full-time')}
              disabled={saving || !user || miss.length > 0}
              style={{ border: '1px solid var(--accent)' }}
            >
              {saving ? 'Saving...' : '💼 Save as Full-time Job'}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 8 }}>
            Part-time: work date ගෙවුණාම site එකෙන් hide වෙනවා (record තියෙනවා).
            Full-time: auto-expire නැහැ — employer / admin delete කරන්න පුළුවන්.
          </p>
        </div>
      )}

      {msg && <div className="msg ok">{msg}</div>}
      {err && <div className="msg err">{err}</div>}
    </div>
  )
}
