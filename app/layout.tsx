import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Petka — pet črk, tvoja poteza', description:'Slovenska besedna igra. Odkrij besedo v osmih poskusih: dnevni izziv ali neskončno igranje.', icons:{icon:'/favicon.svg'} };
export const viewport: Viewport = {width:'device-width',initialScale:1,themeColor:'#101e2b'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="sl"><body>{children}</body></html>; }
