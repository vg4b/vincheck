import React from 'react'

interface BrandMarkProps {
	width?: number
	height?: number
	className?: string
	color?: string
}

/**
 * License-plate-style brand mark for VIN Info.cz.
 * Uses currentColor so the parent controls the fill; pass `color` for inline override.
 */
const BrandMark: React.FC<BrandMarkProps> = ({
	width = 36,
	height = 22,
	className,
	color,
}) => {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 36 22'
			width={width}
			height={height}
			className={className}
			style={color ? { color } : undefined}
			aria-hidden='true'
			focusable='false'
		>
			<rect
				x='0.9'
				y='0.9'
				width='34.2'
				height='20.2'
				rx='3.2'
				ry='3.2'
				fill='#ffffff'
				stroke='currentColor'
				strokeWidth='1.6'
			/>
			<path
				d='M0.9 4.1 A3.2 3.2 0 0 1 4.1 0.9 H7.5 V21.1 H4.1 A3.2 3.2 0 0 1 0.9 17.9 Z'
				fill='currentColor'
			/>
			<text
				x='21.8'
				y='15.5'
				textAnchor='middle'
				fontFamily="Montserrat, 'Helvetica Neue', Arial, sans-serif"
				fontWeight='800'
				fontSize='12'
				letterSpacing='0.4'
				fill='currentColor'
			>
				VI
			</text>
		</svg>
	)
}

export default BrandMark
