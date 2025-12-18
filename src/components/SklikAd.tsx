import React, { useEffect } from 'react'

declare global {
	interface Window {
		sssp?: {
			getAds: (
				ads: Array<{
					zoneId: number
					id: string
					width: number
					height: number
				}>
			) => void
		}
	}
}

interface SklikAdProps {
	zoneId: number
	width: number
	height: number
	id: string
	className?: string
}

const SklikAd: React.FC<SklikAdProps> = ({
	zoneId,
	width,
	height,
	id,
	className
}) => {
	useEffect(() => {
		// Ensure the script is loaded before trying to get ads
		if (window.sssp && typeof window.sssp.getAds === 'function') {
			try {
				window.sssp.getAds([
					{
						zoneId,
						id,
						width,
						height
					}
				])
			} catch (e) {
				console.error('Sklik ad loading error:', e)
			}
		} else {
			// Fallback if script hasn't loaded yet - could set up a mutation observer or interval
			// but usually the script in head loads fast enough.
			// Ideally, we'd listen for the script load event, but it's in index.html
			const checkInterval = setInterval(() => {
				if (window.sssp && typeof window.sssp.getAds === 'function') {
					try {
						window.sssp.getAds([
							{
								zoneId,
								id,
								width,
								height
							}
						])
						clearInterval(checkInterval)
					} catch (e) {
						console.error('Sklik ad loading error:', e)
						clearInterval(checkInterval)
					}
				}
			}, 100)

			// Timeout after 5 seconds
			setTimeout(() => clearInterval(checkInterval), 5000)
		}
	}, [zoneId, id, width, height])

	return (
		<div
			id={id}
			className={className}
		/>
	)
}

export default SklikAd
