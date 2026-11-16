import { withZone } from '@/lib/with-zone';
import { ProfileForm } from '@/member/components/ProfileForm';
import { QueryProvider } from '@/member/QueryProvider';

export const getServerSideProps = withZone({ requireAuth: true });

export default function MemberProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">個人資訊</h1>
      <QueryProvider>
        <ProfileForm />
      </QueryProvider>
    </div>
  );
}
