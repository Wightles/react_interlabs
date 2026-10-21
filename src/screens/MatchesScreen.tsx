import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { MATCHES_URL } from '../config';
import { useFavorites } from '../hooks/useFavorites';

type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | string;

type Match = {
  id: string;
  startsAt: string | null;
  status: MatchStatus;
  minute?: number;
  home: { id: string; name: string; city: string };
  away: { id: string; name: string; city: string };
  score: { home: number; away: number } | null;
};

type MatchFilter = 'all' | 'upcoming' | 'finished';

const filters: { id: MatchFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'upcoming', label: 'Предстоящие' },
  { id: 'finished', label: 'Завершённые' },
];

const statusLabels: Record<string, string> = {
  scheduled: 'Запланирован',
  live: 'Идёт',
  finished: 'Завершён',
  postponed: 'Перенесён',
};

function formatKickoff(value: string | null) {
  if (!value) return 'Дата уточняется';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function MatchCard({ match, favorite, onToggleFavorite }: {
  match: Match;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const status = statusLabels[match.status] ?? 'Статус неизвестен';
  const isLive = match.status === 'live';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={[styles.status, isLive && styles.liveStatus]}>
          {isLive && <Text style={styles.liveDot}>● </Text>}
          {isLive && match.minute != null ? `${match.minute}′ · ` : ''}{status}
        </Text>
        <FavoriteButton active={favorite} onPress={onToggleFavorite} />
      </View>

      <View style={styles.teams}>
        <View style={styles.teamNames}>
          <Text numberOfLines={1} style={styles.teamName}>{match.home.name}</Text>
          <Text numberOfLines={1} style={styles.teamName}>{match.away.name}</Text>
        </View>
        <View style={styles.score}>
          <Text style={styles.scoreValue}>{match.score ? match.score.home : '–'}</Text>
          <Text style={styles.scoreValue}>{match.score ? match.score.away : '–'}</Text>
        </View>
      </View>

      <Text style={styles.kickoff}>{formatKickoff(match.startsAt)}</Text>
    </View>
  );
}

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const [filter, setFilter] = useState<MatchFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { isFavorite, toggle } = useFavorites();

  const loadMatches = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch(MATCHES_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: { round?: number; matches?: Match[] } = await response.json();
      if (!Array.isArray(payload.matches)) {
        throw new Error('В ответе нет списка матчей');
      }
      setMatches(payload.matches);
      setRound(typeof payload.round === 'number' ? payload.round : null);
      setUpdatedAt(new Date());
    } catch {
      setError('Не удалось загрузить матчи. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const visibleMatches = useMemo(() => {
    const filtered = matches.filter((match) => {
      if (filter === 'upcoming') return match.status === 'scheduled' || match.status === 'live';
      if (filter === 'finished') return match.status === 'finished';
      return true;
    });
    return [...filtered].sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [filter, matches]);

  const emptyLabel = filter === 'all'
    ? 'В этом туре пока нет матчей.'
    : filter === 'upcoming'
      ? 'Предстоящих матчей нет.'
      : 'Завершённых матчей пока нет.';

  return (
    <View style={styles.screen}>
      <FlatList
        data={visibleMatches}
        keyExtractor={(match) => match.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadMatches(true)} tintColor="#d85b3f" />
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>
              ПРЕМЬЕР-ЛИГА{round == null ? '' : ` · ТУР ${round}`}
            </Text>
            <View style={styles.headingRow}>
              <View>
                <Text style={styles.title}>Матчи тура</Text>
                <Text style={styles.subtitle}>Расписание и результаты</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void loadMatches(true)}
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
              >
                <Text style={styles.refreshIcon}>↻</Text>
                <Text style={styles.refreshText}>Обновить</Text>
              </Pressable>
            </View>
            {updatedAt ? <UpdatedAgo since={updatedAt} /> : null}

            <View style={styles.filters}>
              {filters.map((item) => {
                const selected = filter === item.id;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setFilter(item.id)}
                    style={[styles.filter, selected && styles.selectedFilter]}
                  >
                    <Text style={[styles.filterText, selected && styles.selectedFilterText]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? null : error ? (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>Не получилось загрузить</Text>
              <Text style={styles.messageText}>{error}</Text>
              <Pressable onPress={() => void loadMatches()} style={styles.retryButton}>
                <Text style={styles.retryText}>Повторить</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>{emptyLabel}</Text>
              {filter !== 'all' && matches.length > 0 ? (
                <Text style={styles.messageText}>Попробуйте выбрать другой фильтр.</Text>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            favorite={isFavorite(item.id)}
            onToggleFavorite={() => toggle(item.id)}
          />
        )}
        ListFooterComponent={loading ? <ActivityIndicator style={styles.loader} color="#d85b3f" /> : null}
      />
      {loading && matches.length === 0 ? (
        <View style={styles.initialLoader}>
          <ActivityIndicator color="#d85b3f" />
          <Text style={styles.loadingText}>Загружаем матчи…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f5f1' },
  listContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  eyebrow: { color: '#a35c46', fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { color: '#252d32', fontSize: 32, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { color: '#737b7e', fontSize: 14, marginTop: 4 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9e5df', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  pressed: { opacity: 0.65 },
  refreshIcon: { color: '#a35c46', fontSize: 18, fontWeight: '600' },
  refreshText: { color: '#454d50', fontSize: 13, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: 8, marginTop: 24, marginBottom: 14 },
  filter: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#eeece7' },
  selectedFilter: { backgroundColor: '#29363b' },
  filterText: { color: '#626a6c', fontSize: 13, fontWeight: '600' },
  selectedFilterText: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#eeece7', padding: 16, marginBottom: 10, shadowColor: '#253136', shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 26 },
  status: { color: '#7a8283', fontSize: 12, fontWeight: '600' },
  liveStatus: { color: '#b33c2e' },
  liveDot: { color: '#d85b3f', fontSize: 9 },
  teams: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  teamNames: { flex: 1, gap: 8, paddingRight: 12 },
  teamName: { color: '#293238', fontSize: 16, fontWeight: '700' },
  score: { minWidth: 48, alignItems: 'flex-end', gap: 6 },
  scoreValue: { color: '#293238', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  kickoff: { color: '#7b8385', fontSize: 12, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0efec' },
  messageBox: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 44, backgroundColor: '#fff', borderRadius: 14, marginTop: 4 },
  messageTitle: { color: '#323b3f', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  messageText: { color: '#7b8385', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
  retryButton: { backgroundColor: '#29363b', borderRadius: 9, paddingHorizontal: 18, paddingVertical: 10, marginTop: 16 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  loader: { paddingVertical: 20 },
  initialLoader: { position: 'absolute', top: 220, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: '#7b8385', fontSize: 13 },
});
