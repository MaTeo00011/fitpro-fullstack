import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationMessage {
  message: string;
  type: NotificationType;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationSubject = new BehaviorSubject<NotificationMessage | null>(null);
  notification$ = this.notificationSubject.asObservable();
  private timeoutHandle: any;

  notify(message: string, type: NotificationType = 'success', duration?: number) {
    const displayDuration = duration ?? (type === 'error' ? 6000 : type === 'info' ? 5000 : 3000);
    this.notificationSubject.next({ message, type });
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
    }
    this.timeoutHandle = setTimeout(() => this.clear(), displayDuration);
  }

  clear() {
    this.notificationSubject.next(null);
  }
}
