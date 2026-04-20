import { UserProfile } from '@clerk/nextjs';

export default function UserProfilePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <UserProfile />
      </div>
    </div>
  );
}
