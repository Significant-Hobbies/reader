import HomeClient from '../../components/HomeClient';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Library',
  alternates: { canonical: '/library' },
};

export default function LibraryPage() {
  return <HomeClient />;
}
