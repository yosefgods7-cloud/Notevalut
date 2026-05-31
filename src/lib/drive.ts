import { addDays, addMonths, isAfter, isBefore } from 'date-fns';
import { DriveBackupSettings, NoteVaultData } from '../types';

export const calculateNextBackupDate = (startDate: Date, frequency: DriveBackupSettings['frequency']): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(startDate, 1);
    case '3days':
      return addDays(startDate, 3);
    case 'weekly':
      return addDays(startDate, 7);
    case 'monthly':
      return addMonths(startDate, 1);
    case '90days':
      return addDays(startDate, 90);
    default:
      return addDays(startDate, 1);
  }
};

export const shouldRunBackup = (settings?: DriveBackupSettings): boolean => {
  if (!settings || !settings.enabled) return false;
  if (!settings.nextBackupDate) return true; // first time
  const nextBackup = new Date(settings.nextBackupDate);
  const now = new Date();
  return isAfter(now, nextBackup) || isBefore(nextBackup, now);
};

export const uploadToDrive = async (accessToken: string, data: NoteVaultData, fileId?: string): Promise<string> => {
  const metadata = {
    name: 'NoteVault_Backup.json',
    mimeType: 'application/json',
    parents: ['root'], // Remove if fileId is present, we don't move it.
  };

  const fileContent = JSON.stringify(data);
  const boundary = 'foo_bar_baz';
  
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(fileId ? { name: metadata.name } : metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    fileContent,
    `--${boundary}--`
  ].join('\r\n');

  const method = fileId ? 'PATCH' : 'POST';
  const url = fileId 
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': body.length.toString(),
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${res.statusText} - ${err}`);
  }

  const result = await res.json();
  return result.id;
};
