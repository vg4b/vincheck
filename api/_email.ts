// Email sending utilities using Resend API

const getResendApiKey = (): string | null => {
	return process.env.RESEND_API_KEY || null
}

/**
 * From-address. Avoids "noreply" per Resend's deliverability guidance
 * (https://resend.com/docs/dashboard/emails/deliverability-insights —
 * no-reply addresses lower trust and engagement signals).
 */
const EMAIL_FROM = 'VIN Info.cz <vininfo@mail.vininfo.cz>'

/**
 * Reply-To target — a real monitored inbox so users who reply land
 * somewhere a human reads. Matches the contact address shown in the
 * site footer.
 *
 * Note: MX inbound for mail.vininfo.cz is configured for a future
 * webhook-based reply handler (Resend inbound requires a webhook —
 * https://resend.com/docs/dashboard/receiving/forward-emails). Until
 * that lands, replies go to the existing fixweb.cz mailbox.
 */
const EMAIL_REPLY_TO = 'vininfo@fixweb.cz'

interface SendEmailParams {
	to: string
	subject: string
	html: string
	text?: string
	replyTo?: string
	headers?: Record<string, string>
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
	const apiKey = getResendApiKey()
	if (!apiKey) {
		console.warn('RESEND_API_KEY is not configured, skipping email send')
		return false
	}

	const maxRetries = 3
	let lastError: string | null = null

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			const response = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					from: EMAIL_FROM,
					to: params.to,
					subject: params.subject,
					html: params.html,
					...(params.text ? { text: params.text } : {}),
					reply_to: params.replyTo ?? EMAIL_REPLY_TO,
					...(params.headers ? { headers: params.headers } : {})
				})
			})

			if (response.ok) {
				return true
			}

			const errorText = await response.text()
			lastError = `${response.status}: ${errorText}`

			// Retry on rate limit (429) with exponential backoff
			if (response.status === 429 && attempt < maxRetries - 1) {
				const backoffMs = Math.pow(2, attempt + 1) * 500 // 1s, 2s, 4s
				console.warn(`Resend rate limit hit, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`)
				await delay(backoffMs)
				continue
			}

			// Don't retry other errors
			console.error('Resend API error:', response.status, errorText)
			return false
		} catch (error) {
			lastError = error instanceof Error ? error.message : 'Unknown error'
			console.error('Failed to send email:', error)
			
			// Retry network errors with backoff
			if (attempt < maxRetries - 1) {
				const backoffMs = Math.pow(2, attempt + 1) * 500
				console.warn(`Email send failed, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`)
				await delay(backoffMs)
				continue
			}
			return false
		}
	}

	console.error('Email send failed after all retries:', lastError)
	return false
}

export function generateVerificationEmailHtml(code: string): string {
	const preheader = 'Dokončete registraci na VIN Info.cz — váš ověřovací kód uvnitř.'
	return `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Ověření emailu - VIN Info.cz</title>
</head>
<body style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
	<div style="display:none!important;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f5f5;opacity:0;">${preheader}</div>
	<div style="background-color: #eaf4eb; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
		<h1 style="margin: 0; font-size: 22px; color: #333; font-weight: 600;">VIN Info.cz</h1>
	</div>

	<div style="background: #ffffff; padding: 30px; border-left: 1px solid #e9ecef; border-right: 1px solid #e9ecef;">
		<h2 style="color: #333; margin-top: 0; font-size: 20px;">Vítejte v Moje VINInfo!</h2>

		<p style="color: #555;">Pro dokončení registrace zadejte následující ověřovací kód:</p>

		<div style="background: #eaf4eb; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
			<p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #333;">${code}</p>
		</div>

		<p style="color: #555;">Kód je platný 24 hodin od odeslání.</p>

		<p style="color: #888; font-size: 14px; margin-top: 25px;">
			Pokud jste si nevytvořili účet na VIN Info.cz, tento email můžete ignorovat.
		</p>
	</div>

	<div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none; text-align: center; font-size: 12px; color: #888;">
		<p style="margin: 0;">Tento email byl odeslán ze služby <a href="https://vininfo.cz" style="color: #555; text-decoration: none;">VIN Info.cz</a></p>
	</div>
</body>
</html>`
}

export function generateVerificationEmailText(code: string): string {
	return [
		'Vítejte v Moje VINInfo!',
		'',
		'Pro dokončení registrace zadejte následující ověřovací kód:',
		'',
		`    ${code}`,
		'',
		'Kód je platný 24 hodin od odeslání.',
		'',
		'Pokud jste si nevytvořili účet na VIN Info.cz, tento email můžete ignorovat.',
		'',
		'— VIN Info.cz (https://vininfo.cz)'
	].join('\n')
}

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
	return sendEmail({
		to: email,
		subject: 'Ověřovací kód pro VINInfo',
		html: generateVerificationEmailHtml(code),
		text: generateVerificationEmailText(code)
	})
}
