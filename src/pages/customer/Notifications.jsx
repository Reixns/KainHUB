import { NotificationsList, customerNotificationStyles } from '@/components/NotificationsList';

export default function CustomerNotifications() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <NotificationsList styles={customerNotificationStyles} />
    </div>
  );
}
