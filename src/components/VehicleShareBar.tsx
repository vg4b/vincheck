import React, { useEffect, useState } from 'react'
import { createVehicleShare } from '../utils/vehicleApi'

interface VehicleShareBarProps {
	vin?: string
	tp?: string
	orv?: string
}

// Filled 24×24 brand glyphs (inlined — a strict CSP blocks icon CDNs/fonts).
const GLYPH = {
	link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
	check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
	whatsapp:
		'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.652a11.98 11.98 0 005.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.893a11.821 11.821 0 00-3.48-8.413z',
	facebook:
		'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
	messenger:
		'M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.974 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.26L19.752 8l-6.561 6.963z',
	x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
	email:
		'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z'
} as const

const Glyph: React.FC<{ d: string }> = ({ d }) => (
	<svg viewBox='0 0 24 24' width='20' height='20' fill='currentColor' aria-hidden='true'>
		<path d={d} />
	</svg>
)

/**
 * Public "share this vehicle" bar. On first click it creates (or fetches) the
 * permanent per-VIN token, builds a short /s/<token> link, and reveals a copy
 * button + brand social buttons (plain share-intent links → CSP-safe).
 */
const VehicleShareBar: React.FC<VehicleShareBarProps> = ({ vin, tp, orv }) => {
	const [url, setUrl] = useState<string | null>(null)
	const [failed, setFailed] = useState(false)
	const [copied, setCopied] = useState(false)

	// Create (or fetch) the permanent per-VIN token up front so the social links
	// are ready immediately. Idempotent — one row per identifier.
	useEffect(() => {
		if (!vin && !tp && !orv) return
		let active = true
		setFailed(false)
		createVehicleShare({ vin, tp, orv })
			.then((token) => {
				if (active) setUrl(`${window.location.origin}/s/${token}`)
			})
			.catch(() => {
				if (active) setFailed(true)
			})
		return () => {
			active = false
		}
	}, [vin, tp, orv])

	const copy = async () => {
		if (!url) return
		try {
			await navigator.clipboard.writeText(url)
			setCopied(true)
			window.setTimeout(() => setCopied(false), 2000)
		} catch {
			window.prompt('Zkopírujte odkaz na sdílení:', url)
		}
	}

	if (!vin && !tp && !orv) return null

	const text = 'Prohlédněte si toto vozidlo na VINInfo.cz'
	const e = encodeURIComponent
	const links = [
		{ key: 'whatsapp', label: 'WhatsApp', href: url && `https://wa.me/?text=${e(`${text} ${url}`)}` },
		{ key: 'facebook', label: 'Facebook', href: url && `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
		{ key: 'messenger', label: 'Messenger', href: url && `fb-messenger://share/?link=${e(url)}` },
		{ key: 'x', label: 'X', href: url && `https://twitter.com/intent/tweet?text=${e(text)}&url=${e(url)}` },
		{ key: 'email', label: 'E-mail', href: url && `mailto:?subject=${e('Vozidlo na VINInfo.cz')}&body=${e(`${text}\n\n${url}`)}` }
	]

	const ready = Boolean(url)
	return (
		<div className='vehicle-share'>
			<div className={`vehicle-share__bar${ready ? '' : ' is-loading'}`}>
				<span className='vehicle-share__label'>Sdílet:</span>
				<button
					type='button'
					className='share-btn share-btn--copy'
					onClick={copy}
					disabled={!ready}
					aria-label='Kopírovat odkaz'
					title={copied ? 'Zkopírováno' : 'Kopírovat odkaz'}
				>
					<Glyph d={copied ? GLYPH.check : GLYPH.link} />
				</button>
				{links.map((l) => (
					<a
						key={l.key}
						className={`share-btn share-btn--${l.key}`}
						href={l.href || undefined}
						target='_blank'
						rel='noopener noreferrer'
						aria-label={l.label}
						title={l.label}
						aria-disabled={!ready}
						tabIndex={ready ? undefined : -1}
					>
						<Glyph d={GLYPH[l.key as keyof typeof GLYPH]} />
					</a>
				))}
				<span
					className={`vehicle-share__copied${copied ? ' is-shown' : ''}`}
					aria-live='polite'
				>
					Odkaz zkopírován
				</span>
			</div>
			{failed && (
				<div className='text-danger small mt-1'>
					Odkaz ke sdílení se nepodařilo vytvořit.
				</div>
			)}
		</div>
	)
}

export default VehicleShareBar
