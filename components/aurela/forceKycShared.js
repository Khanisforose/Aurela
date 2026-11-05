// Shared Force-KYC catalog + helpers (user gate + admin panel)

export const FKYC_REVIEW_HOURS = 48
export const SUPPORT_EMAIL = 'support@aurelawallet.com'

// Document catalog — admin picks per user which of these are mandatory
export const FKYC_DOCS = {
  id_front:         { label: 'Government ID — front', hint: 'Full card visible, all four corners, no glare.', capture: 'environment', pdf: false, icon: 'IdCard' },
  id_back:          { label: 'Government ID — back', hint: 'Back side of the same document.', capture: 'environment', pdf: false, icon: 'IdCard' },
  passport:         { label: 'Passport photo page', hint: 'Open passport flat, the MRZ lines at the bottom must be readable.', capture: 'environment', pdf: false, icon: 'BookUser' },
  drivers_license:  { label: "Driver's licence", hint: 'Front side, clearly readable.', capture: 'environment', pdf: false, icon: 'Car' },
  residence_permit: { label: 'Residence permit / visa', hint: 'Valid permit or visa for your country of residence.', capture: 'environment', pdf: true, icon: 'Stamp' },
  selfie_with_id:   { label: 'Selfie holding your ID', hint: 'Hold the same ID next to your face. Face and ID both sharp.', capture: 'user', pdf: false, icon: 'ScanFace' },
  proof_of_address: { label: 'Proof of address', hint: 'Utility bill, bank letter or government letter issued in the last 3 months, showing your name and address.', capture: 'environment', pdf: true, icon: 'Home' },
  bank_statement:   { label: 'Bank statement', hint: 'Most recent statement (last 3 months) showing your name, bank and account.', capture: 'environment', pdf: true, icon: 'Landmark' },
  source_of_funds:  { label: 'Source of funds evidence', hint: 'Payslip, tax return, business invoice, sale contract or investment statement.', capture: 'environment', pdf: true, icon: 'FileText' },
  tax_id:           { label: 'Tax ID document', hint: 'Document showing your tax ID number.', capture: 'environment', pdf: true, icon: 'Receipt' },
}
export const FKYC_DOC_ORDER = ['id_front', 'id_back', 'passport', 'drivers_license', 'residence_permit', 'selfie_with_id', 'proof_of_address', 'bank_statement', 'source_of_funds', 'tax_id']

// Country-specific tax ID naming
export const TAX_ID_NAMES = {
  US: 'SSN / ITIN', IN: 'PAN', GB: 'National Insurance number', CA: 'SIN', AU: 'TFN', DE: 'Steuer-ID', FR: 'Numéro fiscal', IT: 'Codice fiscale',
  ES: 'NIF / NIE', NL: 'BSN', BR: 'CPF', MX: 'RFC', AR: 'CUIL / CUIT', NG: 'TIN / NIN', ZA: 'Tax reference number', PK: 'NTN / CNIC', BD: 'TIN',
  AE: 'Emirates ID number', SA: 'National ID / Iqama number', JP: 'My Number', KR: 'RRN', CN: 'Resident ID number', SG: 'NRIC / FIN', MY: 'Tax number (TIN)',
  ID: 'NPWP', PH: 'TIN', TR: 'T.C. Kimlik No', KE: 'KRA PIN', GH: 'Ghana Card PIN', EG: 'Tax registration number', PL: 'PESEL / NIP', SE: 'Personnummer',
}
export const taxIdName = (cc) => TAX_ID_NAMES[cc] || 'Tax identification number'

// Suggested document set per country (admin can tweak)
const EEA = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CH', 'GB']
export function suggestedDocs(cc) {
  const base = ['id_front', 'id_back', 'selfie_with_id', 'proof_of_address']
  if (['US', 'IN', 'BR', 'MX', 'AR', 'PK', 'NG'].includes(cc)) return [...base, 'tax_id']
  if (EEA.includes(cc)) return [...base, 'bank_statement']
  if (['AE', 'SA', 'QA', 'KW', 'BH', 'OM'].includes(cc)) return [...base, 'residence_permit']
  return base
}
export const ENHANCED_PRESET = ['passport', 'id_front', 'id_back', 'selfie_with_id', 'proof_of_address', 'bank_statement', 'source_of_funds']

export const SOURCE_OF_FUNDS = ['Salary / employment', 'Business income', 'Investments', 'Savings', 'Crypto trading / mining', 'Inheritance / gift', 'Sale of property or assets', 'Pension / benefits', 'Other']

export const LIVENESS_POOL = [
  { id: 'left', text: 'Slowly turn your head left', short: 'Turn left' },
  { id: 'right', text: 'Slowly turn your head right', short: 'Turn right' },
  { id: 'up', text: 'Tilt your chin up', short: 'Look up' },
  { id: 'smile', text: 'Give us a big smile', short: 'Smile' },
  { id: 'blink', text: 'Blink twice', short: 'Blink' },
  { id: 'closer', text: 'Move a little closer', short: 'Move closer' },
]
export const challengeLabel = (id) => id === 'center' ? 'Look straight' : (LIVENESS_POOL.find(c => c.id === id)?.short || id)

// ---------- Uploads ----------
// Downscale photos client-side (fast uploads, still crisp for review)
export async function compressImage(file, maxDim = 1800, quality = 0.86) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch (e) { return file }
}

const blobToBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(String(r.result).split(',')[1] || '')
  r.onerror = rej
  r.readAsDataURL(blob)
})

// Chunked upload (512 KB parts, retried) → returns file_id
export async function uploadChunked(api, { slot, blob, name, onProgress }) {
  const CHUNK = 512 * 1024
  const total = Math.max(1, Math.ceil(blob.size / CHUNK))
  const mime = (blob.type || 'application/octet-stream').split(';')[0]
  const { file_id } = await api.post('/force-kyc/upload/init', { slot, mime, size: blob.size, chunks: total, name })
  for (let i = 0; i < total; i++) {
    const data = await blobToBase64(blob.slice(i * CHUNK, (i + 1) * CHUNK))
    let attempt = 0
    for (;;) {
      try { await api.post('/force-kyc/upload/chunk', { file_id, index: i, data }); break }
      catch (e) { if (++attempt >= 3) throw e; await new Promise(r => setTimeout(r, 600 * attempt)) }
    }
    onProgress && onProgress(Math.round(((i + 1) / total) * 100))
  }
  await api.post('/force-kyc/upload/complete', { file_id })
  return file_id
}

// Authenticated file → object URL (admin review / user previews)
export async function fetchFileUrl(api, fileId) {
  const res = await fetch(`${api.base}/force-kyc/file/${fileId}`, { headers: api.token ? { Authorization: 'Bearer ' + api.token } : {} })
  if (!res.ok) throw new Error('Could not load file')
  const blob = await res.blob()
  return { url: URL.createObjectURL(blob), mime: blob.type }
}

export function fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return [h, m, sec].map(n => String(n).padStart(2, '0')).join(':')
}
