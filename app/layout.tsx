import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'ActivityTAB — Your team, in sync',description:'Assign work, track deadlines, and bring every task to completion.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,statusBarStyle:'default',title:'ActivityTAB'},icons:{icon:'/icon.svg',apple:'/apple-touch-icon.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#163c32'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
