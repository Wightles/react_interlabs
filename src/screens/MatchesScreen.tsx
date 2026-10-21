import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { MATCHES_URL } from '../config';
import { useFavorites } from '../hooks/useFavorites';

type Match = {
  id: string;
  startsAt: string | null;
  status: string;
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
  scheduled: 'ЗАПЛАНИРОВАН',
  live: 'ИДЁТ',
  finished: 'ЗАВЕРШЁН',
  postponed: 'ПЕРЕНЕСЁН',
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
}

function formatMatchDate(value: string | null) {
  if (!value) return 'Дата уточняется';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата уточняется';
  return new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatKickoff(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function MatchRow({ match, favorite, onToggleFavorite }: {
  match: Match;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  const isLive = match.status === 'live';
  const status = statusLabels[match.status] ?? 'СТАТУС НЕИЗВЕСТЕН';
  const score = match.score ? `${match.score.home} : ${match.score.away}` : '– : –';

  return (
    <View style={styles.matchRow}>
      <View style={styles.matchMeta}>
        <View style={styles.statusLine}>
          {isLive ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.status, isLive && styles.liveStatus]}>
            {isLive && match.minute != null ? `${status} · ${match.minute}′` : status}
          </Text>
        </View>
        <View style={styles.rowActions}>
          {formatKickoff(match.startsAt) ? (
            <Text style={styles.kickoff}>{formatKickoff(match.startsAt)}</Text>
          ) : null}
          <FavoriteButton active={favorite} onPress={onToggleFavorite} />
        </View>
      </View>

      <View style={styles.matchContent}>
        <View style={styles.teamNames}>
          <Text numberOfLines={1} style={styles.teamName}>{match.home.name}</Text>
          <Text numberOfLines={1} style={styles.teamName}>{match.away.name}</Text>
        </View>
        <Text style={[styles.score, !match.score && styles.noScore]}>{score}</Text>
      </View>
    </View>
  );
}

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [round, setRound] = useState<number | null>(null);
  const [filter, setFilter] = useState<MatchFilter>('all');
  const [query, setQuery] = useState('');
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
    const normalizedQuery = normalize(query);
    const filtered = matches.filter((match) => {
      const homeName = normalize(match.home.name);
      const awayName = normalize(match.away.name);
      if (normalizedQuery && !homeName.includes(normalizedQuery) && !awayName.includes(normalizedQuery)) {
        return false;
      }
      if (filter === 'upcoming') return match.status === 'scheduled' || match.status === 'live';
      if (filter === 'finished') return match.status === 'finished';
      return true;
    });
    return [...filtered].sort((a, b) => {
      const aTime = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
  }, [filter, matches, query]);

  const emptyLabel = query.trim()
    ? `По запросу «${query.trim()}» матчей не найдено.`
    : filter === 'all'
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadMatches(true)}
            tintColor="#a6dc45"
            colors={['#a6dc45']}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topline}>
              <View style={styles.sportMark}><Text style={styles.sportMarkText}>＋</Text></View>
              <Text style={styles.sportName}>ФУТБОЛ</Text>
              <Text style={styles.matchCount}>Матчи · {matches.length}</Text>
            </View>

            <View style={styles.headingRow}>
              <View>
                <Text style={styles.title}>Матчи тура</Text>
                <Text style={styles.competition}>
                  МИР РПЛ{round == null ? '' : ` · ${round} ТУР`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Обновить матчи"
                onPress={() => void loadMatches(true)}
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
              >
                <Text style={styles.refreshIcon}>↻</Text>
              </Pressable>
            </View>
            {updatedAt ? <UpdatedAgo since={updatedAt} /> : null}

            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                accessibilityLabel="Поиск по командам"
                value={query}
                onChangeText={setQuery}
                placeholder="Команда или турнир"
                placeholderTextColor="#87949b"
                returnKeyType="search"
                style={styles.searchInput}
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Очистить поиск"
                  hitSlop={10}
                  onPress={() => setQuery('')}
                >
                  <Text style={styles.clearSearch}>×</Text>
                </Pressable>
              ) : null}
            </View>

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
                    <Text style={[styles.filterText, selected && styles.selectedFilterText]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <View style={styles.errorCopy}>
                  <Text style={styles.errorTitle}>
                    {matches.length > 0 ? 'Не удалось обновить матчи' : 'Не удалось загрузить матчи'}
                  </Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadMatches(matches.length > 0)}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Повторить</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading || error ? null : (
            <View style={styles.messageBox}>
              <Text style={styles.messageTitle}>{emptyLabel}</Text>
              {!query.trim() && filter !== 'all' && matches.length > 0 ? (
                <Text style={styles.messageText}>Попробуйте выбрать другой фильтр.</Text>
              ) : null}
            </View>
          )
        }
        renderItem={({ item, index }) => {
          const previousMatch = visibleMatches[index - 1];
          const dateLabel = formatMatchDate(item.startsAt);
          const startsNewDate = !previousMatch || formatMatchDate(previousMatch.startsAt) !== dateLabel;
          return (
            <View>
              {startsNewDate ? (
                <View style={styles.dateHeading}>
                  <Text style={styles.dateHeadingText}>{dateLabel.toLocaleUpperCase('ru-RU')}</Text>
                  <Text style={styles.scoreHeading}>СЧЁТ</Text>
                </View>
              ) : null}
              <MatchRow
                match={item}
                favorite={isFavorite(item.id)}
                onToggleFavorite={() => toggle(item.id)}
              />
            </View>
          );
        }}
        ListFooterComponent={loading ? <ActivityIndicator style={styles.loader} color="#a6dc45" /> : null}
      />
      {loading && matches.length === 0 ? (
        <View style={styles.initialLoader}>
          <ActivityIndicator color="#a6dc45" />
          <Text style={styles.loadingText}>Загружаем матчи…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f151b' },
  listContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    boxSizing: 'border-box',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 40,
  },
  topline: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  sportMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#a6dc45',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },
  sportMarkText: { color: '#172016', fontSize: 18, lineHeight: 20, fontWeight: '700' },
  sportName: { color: '#e8edef', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  matchCount: { color: '#91a0a7', fontSize: 12, marginLeft: 'auto' },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: { color: '#f2f4f5', fontSize: 27, fontWeight: '800', letterSpacing: -0.4 },
  competition: { color: '#a6dc45', fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 5 },
  refreshButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#1c2730',
  },
  pressed: { opacity: 0.65 },
  refreshIcon: { color: '#d8e0e3', fontSize: 24, lineHeight: 28 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1c2730',
    borderRadius: 8,
    paddingHorizontal: 13,
    marginTop: 15,
  },
  searchIcon: { color: '#9aa6ac', fontSize: 22, lineHeight: 25 },
  searchInput: { flex: 1, minWidth: 0, color: '#edf1f2', fontSize: 14, paddingVertical: 12 },
  clearSearch: { color: '#aab5bb', fontSize: 22, paddingHorizontal: 2 },
  filters: {
    flexDirection: 'row',
    width: '100%',
    gap: 3,
    marginTop: 12,
    marginBottom: 18,
    backgroundColor: '#19232b',
    borderRadius: 8,
    padding: 3,
  },
  filter: { flex: 1, flexBasis: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 6 },
  selectedFilter: { backgroundColor: '#a6dc45' },
  filterText: { color: '#aab5bb', fontSize: 12, fontWeight: '600' },
  selectedFilterText: { color: '#172016', fontWeight: '800' },
  dateHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingTop: 17,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#29353d',
  },
  dateHeadingText: { color: '#9aa6ac', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  scoreHeading: { color: '#84929a', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  matchRow: {
    paddingHorizontal: 4,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#26323a',
  },
  matchMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 22 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a6dc45' },
  status: { color: '#91a0a7', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  liveStatus: { color: '#a6dc45' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kickoff: { color: '#9aa6ac', fontSize: 11, fontVariant: ['tabular-nums'] },
  matchContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  teamNames: { flex: 1, gap: 5, paddingRight: 12 },
  teamName: { color: '#edf1f2', fontSize: 14, fontWeight: '600' },
  score: { minWidth: 62, textAlign: 'center', color: '#f1f3f4', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  noScore: { color: '#819098' },
  messageBox: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, backgroundColor: '#19232b', borderRadius: 10 },
  messageTitle: { color: '#edf1f2', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  messageText: { color: '#9aa6ac', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: 13, backgroundColor: '#302322', borderColor: '#543a37', borderWidth: 1, borderRadius: 8, marginBottom: 14 },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#f2c0b6', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#c9a39c', fontSize: 11, lineHeight: 16, marginTop: 4 },
  retryButton: { backgroundColor: '#a6dc45', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9 },
  retryText: { color: '#172016', fontSize: 11, fontWeight: '800' },
  loader: { paddingVertical: 20 },
  initialLoader: { position: 'absolute', top: 220, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadingText: { color: '#aab5bb', fontSize: 13 },
});
