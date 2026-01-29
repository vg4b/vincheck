// Email sending utilities using Resend API

const getResendApiKey = (): string | null => {
	return process.env.RESEND_API_KEY || null
}

interface SendEmailParams {
	to: string
	subject: string
	html: string
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
					from: 'VINInfo <noreply@mail.vininfo.cz>',
					to: params.to,
					subject: params.subject,
					html: params.html
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

export async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
	const html = `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Ověření emailu - VIN Info.cz</title>
</head>
<body style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
	<div style="background-color: #c6dbad; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
		<h1 style="margin: 0; font-size: 22px; color: #333; font-weight: 600;">VIN Info.cz</h1>
	</div>

	<div style="background: #ffffff; padding: 30px; border-left: 1px solid #e9ecef; border-right: 1px solid #e9ecef;">
		<h2 style="color: #333; margin-top: 0; font-size: 20px;">Vítejte v Moje VINInfo!</h2>
		
		<p style="color: #555;">Pro dokončení registrace zadejte následující ověřovací kód:</p>

		<div style="background: #c6dbad; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
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

	return sendEmail({
		to: email,
		subject: 'Ověřovací kód pro VINInfo',
		html
	})
}
