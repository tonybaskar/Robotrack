// Cloudinary is used ONLY for images. Firestore only ever stores the
// resulting URL + publicId, never the file itself.
//
// Uses an unsigned upload preset so uploads can happen straight from the
// browser without a backend. Create an unsigned preset in the Cloudinary
// console (Settings -> Upload -> Upload presets) and put its name + your
// cloud name in .env.

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

/**
 * Upload a single image file to Cloudinary.
 * @param {File} file
 * @returns {Promise<{ imageUrl: string, publicId: string }>}
 */
export async function uploadClassPhoto(file) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env.'
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', 'robotics-trainer/sessions')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    throw new Error('Photo upload failed. Check your connection and try again.')
  }

  const data = await response.json()
  return { imageUrl: data.secure_url, publicId: data.public_id }
}

/**
 * Insert a small on-the-fly Cloudinary transformation into an existing
 * delivery URL so reports pull down a resized/compressed thumbnail
 * instead of the full-resolution original (spec section 21 — avoid
 * downloading unnecessary images).
 * e.g. https://res.cloudinary.com/<cloud>/image/upload/v123/f.jpg
 *   -> https://res.cloudinary.com/<cloud>/image/upload/w_200,h_200,c_fill,q_auto,f_auto/v123/f.jpg
 */
export function cloudinaryThumbUrl(url, size = 200) {
  if (!url || !url.includes('/upload/')) return url
  return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`)
}
