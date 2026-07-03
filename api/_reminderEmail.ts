import { sql } from '@vercel/postgres'
import { EMAIL_HEAD_STYLES, EMAIL_LOGO_URL, sendEmail } from './_email'
import { formatDate, getBaseUrl } from './_utils'
import { generateUnsubscribeToken } from './email/unsubscribe'

export { formatDate, getBaseUrl }

/** Cebia eHub affiliate URL s VIN */
function getCebiaAffiliateUrl(vin: string): string {
	const dest = `https://cz.cebia.com/?vin=${encodeURIComponent(vin)}`
	return `https://ehub.cz/system/scripts/click.php?a_aid=9a3cbf23&a_bid=67e04d9d&desturl=${encodeURIComponent(dest)}&data1=email_reminder`
}

export const reminderTypeLabels: Record<string, string> = {
	stk: 'Termín STK',
	povinne_ruceni: 'Povinné ručení',
	havarijni_pojisteni: 'Havarijní pojištění',
	servis: 'Servisní prohlídka',
	prezuti_pneu: 'Přezutí pneu',
	dalnicni_znamka: 'Dálniční známka',
	jine: 'Jiné'
}

interface ReminderEmailParams {
	vehicleName: string
	reminderType: string
	reminderTypeRaw: string
	dueDate: string
	note: string | null
	unsubscribeUrl: string
	vehicleVin: string | null
	baseUrl: string
}

function promoBlockHtml(message: string, href: string, label: string): string {
	return `
		<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
			<tr>
				<td class="email-footer email-border" style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; border: 1px solid #e9ecef;">
					<p class="email-text" style="margin: 0 0 10px; font-size: 14px; color: #555;">${message}</p>
					<table role="presentation" cellpadding="0" cellspacing="0" border="0">
						<tr>
							<td style="background-color: #2f7a3e; border-radius: 5px;">
								<a href="${href}" style="display: inline-block; padding: 10px 20px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">${label}</a>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>`
}

function getPromoBlockHtml(params: ReminderEmailParams): string {
	const { reminderTypeRaw, vehicleVin, baseUrl } = params
	const vin = vehicleVin?.trim()
	const hasVin = vin && vin.length === 17

	if (
		reminderTypeRaw === 'povinne_ruceni' ||
		reminderTypeRaw === 'havarijni_pojisteni'
	) {
		const sjednatUrl = hasVin
			? `${baseUrl}/sjednat-pojisteni?vin=${encodeURIComponent(vin)}`
			: `${baseUrl}/sjednat-pojisteni`
		return promoBlockHtml(
			'Sjednejte si pojištění online během pár minut – bez telefonátů a za jedny z nejlepších cen na trhu.',
			sjednatUrl,
			'Sjednat pojištění online'
		)
	}
	if (reminderTypeRaw === 'stk' && hasVin) {
		return promoBlockHtml(
			'Zvažujete koupi nového vozu? Prověřte si historii vozidla.',
			getCebiaAffiliateUrl(vin),
			'Prověřit historii vozidla'
		)
	}
	if (
		['servis', 'prezuti_pneu', 'dalnicni_znamka', 'jine'].includes(
			reminderTypeRaw
		)
	) {
		return promoBlockHtml(
			'Prohlédněte si doporučené služby pro vaše vozidla.',
			`${baseUrl}/klientska-zona?tab=benefits`,
			'Moje výhody'
		)
	}
	return ''
}

export function generateReminderEmailHtml(params: ReminderEmailParams): string {
	const { vehicleName, reminderType, dueDate, note, unsubscribeUrl, baseUrl } =
		params
	const promoBlock = getPromoBlockHtml(params)
	const preheader = `${reminderType} pro ${vehicleName} — termín ${dueDate}.`

	return `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta name="color-scheme" content="light dark">
	<meta name="supported-color-schemes" content="light dark">
	<meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
	<meta name="x-apple-disable-message-reformatting">
	<title>Připomínka - VIN Info.cz</title>
	${EMAIL_HEAD_STYLES}
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
	<div style="display:none!important;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f5f5f5;opacity:0;">${preheader}</div>
	<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-body" style="background-color: #f5f5f5;">
		<tr>
			<td align="center" style="padding: 20px;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%;">
					<tr>
						<td class="email-tint" style="background-color: #eaf4eb; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
							<a href="https://www.vininfo.cz" style="display: inline-block; text-decoration: none; color: inherit;">
								<img src="${EMAIL_LOGO_URL}" alt="" width="44" height="28" style="display: inline-block; vertical-align: middle; margin-right: 10px; border: 0;">
								<span class="email-text" style="display: inline-block; vertical-align: middle; font-size: 22px; color: #333; font-weight: 600;">VINInfo.cz</span>
							</a>
						</td>
					</tr>
					<tr>
						<td class="email-surface email-pad email-border" style="background-color: #ffffff; padding: 30px; border-left: 1px solid #e9ecef; border-right: 1px solid #e9ecef;">
							<h2 class="email-h2" style="color: #333; margin: 0 0 16px; font-size: 20px;">Blíží se termín: ${reminderType}</h2>
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
								<tr>
									<td class="email-tint" style="background-color: #eaf4eb; padding: 20px; border-radius: 8px;">
										<p class="email-text" style="margin: 0 0 10px; color: #333;"><strong>Vozidlo:</strong> ${vehicleName}</p>
										<p class="email-text" style="margin: 0 0 10px; color: #333;"><strong>Typ upozornění:</strong> ${reminderType}</p>
										<p class="email-text" style="margin: 0; color: #333;"><strong>Termín:</strong> <span style="color: #b91c1c; font-weight: bold;">${dueDate}</span></p>
										${note ? `<p class="email-text" style="margin: 10px 0 0; color: #333;"><strong>Poznámka:</strong> ${note}</p>` : ''}
									</td>
								</tr>
							</table>
							<p class="email-text" style="color: #555; margin: 0 0 16px;">Nezapomeňte si včas zajistit splnění tohoto termínu. V případě potřeby můžete termín upravit v klientské zóně.</p>
							${promoBlock}
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 30px auto;">
								<tr>
									<td style="background-color: #2f7a3e; border-radius: 5px;">
										<a href="${baseUrl}/klientska-zona" style="display: inline-block; padding: 12px 30px; color: #ffffff; text-decoration: none; font-weight: 600;">Přejít do Moje VINInfo</a>
									</td>
								</tr>
							</table>
						</td>
					</tr>
					<tr>
						<td class="email-footer email-border email-text-muted" style="background-color: #f8f9fa; padding: 20px; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px; text-align: center; font-size: 12px; color: #888;">
							<p style="margin: 0 0 10px;">Tento email byl odeslán ze služby <a href="https://www.vininfo.cz" style="color: #555; text-decoration: none;">VINInfo.cz</a></p>
							<p style="margin: 0;"><a href="${unsubscribeUrl}" style="color: #888;">Odhlásit se z odběru notifikací</a></p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`
}

export function generateReminderEmailText(params: ReminderEmailParams): string {
	const { vehicleName, reminderType, dueDate, note, unsubscribeUrl, baseUrl } =
		params
	const lines: string[] = [
		`Blíží se termín: ${reminderType}`,
		'',
		`Vozidlo:        ${vehicleName}`,
		`Typ upozornění: ${reminderType}`,
		`Termín:         ${dueDate}`
	]
	if (note) {
		lines.push(`Poznámka:       ${note}`)
	}
	lines.push(
		'',
		'Nezapomeňte si včas zajistit splnění tohoto termínu. V případě potřeby můžete termín upravit v klientské zóně.',
		'',
		`Přejít do Moje VINInfo: ${baseUrl}/klientska-zona`,
		'',
		'— VINInfo.cz (https://www.vininfo.cz)',
		`Odhlásit se z odběru notifikací: ${unsubscribeUrl}`
	)
	return lines.join('\n')
}

interface SendReminderEmailParams {
	reminderId: string
	userId: string
	userEmail: string
	vehicleTitle: string | null
	vehicleBrand: string | null
	vehicleModel: string | null
	vehicleVin: string | null
	reminderType: string
	dueDate: string
	note: string | null
}

/**
 * Send a reminder email immediately and mark it as sent
 * Returns true if sent successfully, false otherwise
 */
export async function sendReminderEmailNow(
	params: SendReminderEmailParams
): Promise<boolean> {
	try {
		const vehicleName =
			params.vehicleTitle?.trim() ||
			`${params.vehicleBrand || 'Vozidlo'} ${params.vehicleModel || ''}`.trim()

		const unsubscribeToken = generateUnsubscribeToken(
			params.userId,
			'notifications'
		)
		const unsubscribeUrl = `${getBaseUrl()}/api/email/unsubscribe?token=${unsubscribeToken}`

		const baseUrl = getBaseUrl()
		const templateParams = {
			vehicleName,
			reminderType:
				reminderTypeLabels[params.reminderType] || params.reminderType,
			reminderTypeRaw: params.reminderType,
			dueDate: formatDate(params.dueDate),
			note: params.note,
			unsubscribeUrl,
			vehicleVin: params.vehicleVin,
			baseUrl
		}
		const emailHtml = generateReminderEmailHtml(templateParams)
		const emailText = generateReminderEmailText(templateParams)

		const success = await sendEmail({
			to: params.userEmail,
			subject: `Připomínka: ${reminderTypeLabels[params.reminderType] || params.reminderType} - ${vehicleName}`,
			html: emailHtml,
			text: emailText,
			// RFC 8058 — lets Gmail / Apple Mail show a native one-click
			// Unsubscribe button next to the sender name. Reuses the
			// existing unsubscribeUrl token so no new endpoint is needed.
			headers: {
				'List-Unsubscribe': `<${unsubscribeUrl}>`,
				'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
			}
		})

		if (!success) {
			return false
		}

		// Mark reminder as sent
		await sql`
			UPDATE reminders
			SET email_sent_at = now()
			WHERE id = ${params.reminderId};
		`

		return true
	} catch (error) {
		console.error('Error sending reminder email:', error)
		return false
	}
}