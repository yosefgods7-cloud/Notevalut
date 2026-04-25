import React, { useState } from 'react';
import { StorageProvider } from './context/StorageContext';
import { MainLayout } from './components/MainLayout';

export default function App() {
  return (
    <StorageProvider>
      <MainLayout />
    </StorageProvider>
  );
}
