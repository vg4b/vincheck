import { sql } from '@vercel/postgres'
import { sendEmail } from './_email'
import { formatDate, getBaseUrl } from './_utils'
import { generateUnsubscribeToken } from './email/unsubscribe'

export { formatDate, getBaseUrl }

/** Cebia eHub affiliate URL s VIN */
function getCebiaAffiliateUrl(vin: string): string {
	const dest = `https://cz.cebia.com/?vin=${encodeURIComponent(vin)}`
	return `https://ehub.cz/system/scripts/click.php?a_aid=9a3cbf23&a_bid=67e04d9d&desturl=${encodeURIComponent(dest)}`
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
		return `
		<div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
			<p style="margin: 0 0 10px; font-size: 14px; color: #555;">Sjednejte si pojištění online během pár minut – bez telefonátů a za jedny z nejlepších cen na trhu.</p>
			<a href="${sjednatUrl}" style="display: inline-block; background: #5a8f3e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">Sjednat pojištění online</a>
		</div>`
	}
	if (reminderTypeRaw === 'stk' && hasVin) {
		const cebiaUrl = getCebiaAffiliateUrl(vin)
		return `
		<div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
			<p style="margin: 0 0 10px; font-size: 14px; color: #555;">Zvažujete koupi nového vozu? Prověřte si historii vozidla.</p>
			<a href="${cebiaUrl}" style="display: inline-block; background: #5a8f3e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">Prověřit historii vozidla</a>
		</div>`
	}
	if (
		['servis', 'prezuti_pneu', 'dalnicni_znamka', 'jine'].includes(
			reminderTypeRaw
		)
	) {
		const benefitsUrl = `${baseUrl}/klientska-zona?tab=benefits`
		return `
		<div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef;">
			<p style="margin: 0 0 10px; font-size: 14px; color: #555;">Prohlédněte si doporučené služby pro vaše vozidla.</p>
			<a href="${benefitsUrl}" style="display: inline-block; background: #5a8f3e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">Moje výhody</a>
		</div>`
	}
	return ''
}

export function generateReminderEmailHtml(params: ReminderEmailParams): string {
	const { vehicleName, reminderType, dueDate, note, unsubscribeUrl, baseUrl } =
		params
	const promoBlock = getPromoBlockHtml(params)

	return `<!DOCTYPE html>
<html lang="cs">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Připomínka - VIN Info.cz</title>
</head>
<body style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
	<div style="background-color: #c6dbad; padding: 25px 30px; border-radius: 8px 8px 0 0; text-align: center;">
		<h1 style="margin: 0; font-size: 22px; color: #333; font-weight: 600;">VIN Info.cz</h1>
	</div>

	<div style="background: #ffffff; padding: 30px; border-left: 1px solid #e9ecef; border-right: 1px solid #e9ecef;">
		<h2 style="color: #333; margin-top: 0; font-size: 20px;">Blíží se termín: ${reminderType}</h2>

		<div style="background: #c6dbad; padding: 20px; border-radius: 8px; margin: 20px 0;">
			<p style="margin: 0 0 10px; color: #333;"><strong>Vozidlo:</strong> ${vehicleName}</p>
			<p style="margin: 0 0 10px; color: #333;"><strong>Typ upozornění:</strong> ${reminderType}</p>
			<p style="margin: 0; color: #333;"><strong>Termín:</strong> <span style="color: #c0392b; font-weight: bold;">${dueDate}</span></p>
			${note ? `<p style="margin: 10px 0 0; color: #333;"><strong>Poznámka:</strong> ${note}</p>` : ''}
		</div>

		<p style="color: #555;">Nezapomeňte si včas zajistit splnění tohoto termínu. V případě potřeby můžete termín upravit v klientské zóně.</p>
		${promoBlock}
		<div style="text-align: center; margin: 30px 0;">
			<a href="${baseUrl}/klientska-zona" style="display: inline-block; background: #5a8f3e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600;">Přejít do Moje VINInfo</a>
		</div>
	</div>

	<div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef; border-top: none; text-align: center; font-size: 12px; color: #888;">
		<p style="margin: 0 0 10px;">Tento email byl odeslán ze služby <a href="https://vininfo.cz" style="color: #555; text-decoration: none;">VIN Info.cz</a></p>
		<p style="margin: 0;">
			<a href="${unsubscribeUrl}" style="color: #888;">Odhlásit se z odběru notifikací</a>
		</p>
	</div>
</body>
</html>`
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
		const emailHtml = generateReminderEmailHtml({
			vehicleName,
			reminderType:
				reminderTypeLabels[params.reminderType] || params.reminderType,
			reminderTypeRaw: params.reminderType,
			dueDate: formatDate(params.dueDate),
			note: params.note,
			unsubscribeUrl,
			vehicleVin: params.vehicleVin,
			baseUrl
		})

		const success = await sendEmail({
			to: params.userEmail,
			subject: `Připomínka: ${reminderTypeLabels[params.reminderType] || params.reminderType} - ${vehicleName}`,
			html: emailHtml
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