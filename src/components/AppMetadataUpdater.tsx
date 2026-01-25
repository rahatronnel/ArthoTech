"use client";

import { useEffect } from 'react';
import { useOrganization } from '@/context/OrganizationContext';

export function AppMetadataUpdater() {
  const { orgInfo } = useOrganization();

  useEffect(() => {
    if (orgInfo.name) {
      document.title = orgInfo.name;
    }
    
    const favicon = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
    if (favicon) {
        if (orgInfo.favicon) {
            favicon.href = orgInfo.favicon;
        }
    } else {
        if (orgInfo.favicon) {
            const newFavicon = document.createElement('link');
            newFavicon.rel = 'icon';
            newFavicon.href = orgInfo.favicon;
            document.head.appendChild(newFavicon);
        }
    }
  }, [orgInfo]);

  return null; // This component doesn't render anything
}
