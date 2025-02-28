import { AccountLayout } from '@/components/settings/Layout';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { Button } from '@/components/Button';
import { useApi, useAuth } from '@/hooks';
import type { UserSocialMediaConnection } from '@statsfm/statsfm.js';
import type { GetServerSideProps, NextPage } from 'next';
import { useEffect, useState } from 'react';
import type { SSRProps } from '@/utils/ssrUtils';
import { fetchUser } from '@/utils/ssrUtils';
import { event } from 'nextjs-google-analytics';

type PlatformType = {
  status: 'LOADING' | 'CONNECTED' | 'DISCONNECTED';
  key: string;
  name: string;
  icon: string;
  description: string;
  connection: UserSocialMediaConnection | null;
  connect: () => void;
  disconnect: () => void;
};

const useConnections = () => {
  const api = useApi();

  const initialPlatforms: PlatformType[] = [
    {
      status: 'LOADING',
      key: 'discord',
      name: 'Discord',
      icon: 'https://cdn.stats.fm/file/statsfm/images/brands/discord/color.svg',
      description:
        'Connect your Discord account to get access to personalized commands with the stats.fm Discord bot',
      connection: null as UserSocialMediaConnection | null,
      // TODO: optimistic updates for connecting
      connect: () => {
        event('SETTINGS_connections_discord_connect');
        window.location.href = `${api.http.config.baseUrl}/me/connections/discord/redirect?authorization=${api.http.config.accessToken}&redirect_uri=${window.location.href}`;
      },
      disconnect: () => {
        event('SETTINGS_connections_discord_disconnect');
      },
    },
  ];

  const [platforms, setPlatforms] = useState(initialPlatforms);

  const refetch = async () => {
    const userConnections = await api.me.socialMediaConnections();
    const hydratedPlatforms = platforms.map<PlatformType>((platform) => {
      const connection = userConnections.find(
        (connection) => connection.platform.name === platform.name
      );

      if (!connection)
        return {
          ...platform,
          status: 'DISCONNECTED',
        };

      return {
        ...platform,
        status: 'CONNECTED',
        connection,
        disconnect: async () => {
          await api.me.removeSocialMediaConnection(connection.id);

          const optimisticPlatforms = platforms.map<PlatformType>((platform) =>
            platform.name === connection.platform.name
              ? { ...platform, status: 'DISCONNECTED' }
              : platform
          );
          setPlatforms(optimisticPlatforms);
        },
      };
    });

    setPlatforms(hydratedPlatforms);
  };

  useEffect(() => {
    refetch();
  }, []);

  return platforms;
};

// TODO: prefetch connections on the server
const ConnectionsList = () => {
  const platforms = useConnections();

  return (
    <div className="relative w-full">
      <SettingsHeader title="Connections" />

      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {platforms.map((platform) => (
          <li
            className="mb-4 w-full rounded-xl bg-foreground py-4 px-5"
            key={platform.key}
          >
            <h2 className="flex items-center gap-2">
              <img src={platform.icon} alt="icon" className="h-6" />
              {platform.name}
            </h2>

            <p className="-mt-1 text-sm text-neutral-500 sm:-mt-2">
              {platform.status === 'CONNECTED' && platform.connection
                ? `Connected as: ${platform.connection.platformUsername}`
                : 'Not Connected'}
            </p>

            <div className="flex flex-col lg:flex-row">
              <p className="">{platform.description}</p>
              <Button
                className="mt-auto h-min rounded-xl px-4 py-2"
                disabled={platform.status === 'LOADING'}
                onClick={
                  platform.status === 'CONNECTED'
                    ? platform.disconnect
                    : platform.connect
                }
              >
                {(() => {
                  if (platform.status === 'LOADING') return 'LOADING';
                  if (platform.status === 'CONNECTED') return 'Disconnect';
                  return 'Connect';
                })()}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<SSRProps> = async (ctx) => {
  const user = await fetchUser(ctx);

  return {
    props: {
      user,
    },
  };
};

const ConnectionsPage: NextPage = () => {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <AccountLayout>
      <ConnectionsList />
    </AccountLayout>
  );
};

export default ConnectionsPage;
