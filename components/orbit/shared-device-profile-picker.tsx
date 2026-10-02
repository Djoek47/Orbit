import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/orbit/avatar';
import { AppText as Text } from '@/components/orbit/app-text';
import { space } from '@/constants/orbit-theme';
import { getAccentTheme } from '@/constants/accent-themes';
import {
  profilePickerLayout,
  profilePickerRows,
  type ProfilePickerLayout,
} from '@/lib/device/profile-picker-layout';
import { memberDisplayEmoji, isAvatarImageUri } from '@/lib/game-levels';
import type { HouseholdMember } from '@/types/orbit';

type Props = {
  profiles: HouseholdMember[];
  backgroundSoft: string;
  textColor: string;
  onSelect: (member: HouseholdMember) => void;
  onRemove: (member: HouseholdMember) => void;
};

export function SharedDeviceProfilePicker({
  profiles,
  backgroundSoft,
  textColor,
  onSelect,
  onRemove,
}: Props) {
  const layout = profilePickerLayout(profiles.length);
  const rows = profilePickerRows(profiles, layout.columns);

  return (
    <View style={styles.stack}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={[styles.row, { gap: layout.gap, marginBottom: rowIndex < rows.length - 1 ? layout.gap : 0 }]}>
          {row.map((member) => (
            <ProfileTile
              key={member.id}
              member={member}
              layout={layout}
              backgroundSoft={backgroundSoft}
              textColor={textColor}
              onPress={() => onSelect(member)}
              onLongPress={() => onRemove(member)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function ProfileTile({
  member,
  layout,
  backgroundSoft,
  textColor,
  onPress,
  onLongPress,
}: {
  member: HouseholdMember;
  layout: ProfilePickerLayout;
  backgroundSoft: string;
  textColor: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = getAccentTheme(member.accentThemeId);
  const photo = isAvatarImageUri(member.avatar);
  const inner = layout.ring - 6;
  const avatarSize = layout.ring >= 100 ? 'xl' : layout.ring >= 88 ? 'l' : 'm';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      style={[styles.tile, { width: layout.tileWidth }]}
      accessibilityRole="button"
      accessibilityLabel={`Continue as ${member.name}. Long press to remove from this device.`}>
      <LinearGradient
        colors={[theme.primary, theme.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.ring,
          {
            width: layout.ring,
            height: layout.ring,
            borderRadius: layout.ring / 2,
          },
        ]}>
        <View
          style={[
            styles.inner,
            {
              backgroundColor: backgroundSoft,
              width: inner,
              height: inner,
              borderRadius: inner / 2,
            },
          ]}>
          <Avatar
            name={member.name}
            emoji={memberDisplayEmoji(member)}
            imageUri={photo ? member.avatar : undefined}
            size={avatarSize}
          />
        </View>
      </LinearGradient>
      <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
        {member.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    marginTop: space.lg,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  tile: {
    alignItems: 'center',
    gap: 10,
  },
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: '100%',
    textAlign: 'center',
  },
});
