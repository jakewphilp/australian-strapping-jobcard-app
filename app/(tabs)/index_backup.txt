import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Job = {
  id: string;
  worker: string;
  site: string;
  hours: string;
  desc: string;
  createdAt: string;
  photoUris: string[];
};

type SummaryRow = {
  label: string;
  totalHours: number;
};

type MonthlyGroup = {
  monthKey: string;
  monthLabel: string;
  totalHours: number;
  jobs: Job[];
  weeklyRows: SummaryRow[];
  workerRows: SummaryRow[];
};

const JOBS_STORAGE_KEY = 'australian-strapping-job-cards';
const SITES_STORAGE_KEY = 'australian-strapping-quick-sites';

const WORKERS = ['All', 'Terry', 'Jake', 'Luke', 'Zack', 'Robbie', 'Grace', 'Daniel', 'Other'];
const FORM_WORKERS = WORKERS.filter((w) => w !== 'All');
const DEFAULT_SITES = ['Home', 'LDC Dalby', 'QLD Cecil Plains', 'Colly Gin'];

export default function HomeScreen() {
  const [worker, setWorker] = useState('Jake');
  const [site, setSite] = useState('');
  const [hours, setHours] = useState('');
  const [desc, setDesc] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quickSites, setQuickSites] = useState<string[]>(DEFAULT_SITES);
  const [filterWorker, setFilterWorker] = useState('All');
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [monthlyExpanded, setMonthlyExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    saveJobs();
  }, [jobs]);

  useEffect(() => {
    saveQuickSites();
  }, [quickSites]);

  const loadData = async () => {
    try {
      const savedJobs = await AsyncStorage.getItem(JOBS_STORAGE_KEY);
      const savedSites = await AsyncStorage.getItem(SITES_STORAGE_KEY);

      if (savedJobs) {
        const parsedJobs: Job[] = JSON.parse(savedJobs);
        const cleanedJobs = parsedJobs.map((job) => ({
          ...job,
          photoUris: Array.isArray(job.photoUris)
            ? job.photoUris
            : // fallback for any older single-photo version
              ((job as Job & { photoUri?: string }).photoUri ? [(job as Job & { photoUri?: string }).photoUri!] : []),
        }));
        setJobs(cleanedJobs);
      }

      if (savedSites) {
        setQuickSites(JSON.parse(savedSites));
      }
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };

  const saveJobs = async () => {
    try {
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
    } catch (error) {
      console.log('Error saving jobs:', error);
    }
  };

  const saveQuickSites = async () => {
    try {
      await AsyncStorage.setItem(SITES_STORAGE_KEY, JSON.stringify(quickSites));
    } catch (error) {
      console.log('Error saving quick sites:', error);
    }
  };

  const addQuickSiteIfNeeded = (siteName: string) => {
    const trimmed = siteName.trim();
    if (!trimmed) return;

    const exists = quickSites.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setQuickSites((current) => [...current, trimmed]);
    }
  };

  const clearForm = () => {
    setWorker('Jake');
    setSite('');
    setHours('');
    setDesc('');
    setPhotoUris([]);
  };

  const pickImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.7,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const newUris = result.assets
          .map((asset) => asset.uri)
          .filter(Boolean);

        setPhotoUris((current) => {
          const merged = [...current];
          for (const uri of newUris) {
            if (!merged.includes(uri)) {
              merged.push(uri);
            }
          }
          return merged;
        });
      }
    } catch (error) {
      console.log('Error picking images:', error);
      Alert.alert('Error', 'Could not pick images.');
    }
  };

  const removeSelectedPhoto = (uriToRemove: string) => {
    setPhotoUris((current) => current.filter((uri) => uri !== uriToRemove));
  };

  const addJob = () => {
    const trimmedSite = site.trim();
    const trimmedHours = hours.trim();
    const trimmedDesc = desc.trim();

    if (!worker || !trimmedSite || !trimmedHours || !trimmedDesc) {
      Alert.alert('Missing details', 'Please complete all fields.');
      return;
    }

    if (Number.isNaN(Number(trimmedHours)) || Number(trimmedHours) <= 0) {
      Alert.alert('Invalid hours', 'Please enter a valid number of hours.');
      return;
    }

    const newJob: Job = {
      id: Date.now().toString(),
      worker,
      site: trimmedSite,
      hours: trimmedHours,
      desc: trimmedDesc,
      createdAt: new Date().toISOString(),
      photoUris,
    };

    setJobs((current) => [newJob, ...current]);
    addQuickSiteIfNeeded(trimmedSite);
    clearForm();
  };

  const deleteJob = (id: string) => {
  const confirmed =
    typeof window !== 'undefined'
      ? window.confirm('Are you sure you want to delete this job card?')
      : true;

  if (!confirmed) return;

  setJobs((current) => current.filter((job) => job.id !== id));
};

  const deleteQuickSite = (siteName: string) => {
    Alert.alert('Delete quick site', `Remove "${siteName}" from quick sites?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setQuickSites((current) => current.filter((s) => s !== siteName));
          if (site === siteName) {
            setSite('');
          }
        },
      },
    ]);
  };

  const clearAllJobs = () => {
    Alert.alert('Clear all job cards', 'Are you sure you want to delete all saved job cards?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: () => setJobs([]),
      },
    ]);
  };

  const filteredJobs = useMemo(() => {
    if (filterWorker === 'All') return jobs;
    return jobs.filter((job) => job.worker === filterWorker);
  }, [jobs, filterWorker]);

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-AU');
  };

  const formatTime = (iso: string) => {
  const date = new Date(iso);

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';

  hours = hours % 12;
  hours = hours === 0 ? 12 : hours;

  const minStr = minutes < 10 ? `0${minutes}` : minutes;

  return `${hours}:${minStr} ${ampm}`;
};

  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('en-AU');
  };

  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + diff);
    return d;
  };

  const getSunday = (date: Date) => {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  const getWeekRangeLabel = (dateInput: Date) => {
    const monday = getMonday(dateInput);
    const sunday = getSunday(dateInput);
    return `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
  };

  const getMonthLabel = (dateInput: Date) => {
    return dateInput.toLocaleDateString('en-AU', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getMonthKey = (dateInput: Date) => {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  const totalHours = useMemo(() => {
    return filteredJobs.reduce((sum, job) => sum + Number(job.hours || 0), 0);
  }, [filteredJobs]);

  const dailyRows = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const job of filteredJobs) {
      const label = formatDate(job.createdAt);
      totals[label] = (totals[label] || 0) + Number(job.hours || 0);
    }

    return Object.entries(totals)
      .map(([label, totalHoursValue]) => ({
        label,
        totalHours: totalHoursValue,
        sortDate: new Date(label.split('/').reverse().join('-')).getTime(),
      }))
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [filteredJobs]);

  const weeklyRows = useMemo(() => {
    const totals: Record<string, number> = {};

    for (const job of filteredJobs) {
      const label = getWeekRangeLabel(new Date(job.createdAt));
      totals[label] = (totals[label] || 0) + Number(job.hours || 0);
    }

    return Object.entries(totals)
      .map(([label, totalHoursValue]) => ({
        label,
        totalHours: totalHoursValue,
      }))
      .sort((a, b) => {
        const [aStart] = a.label.split(' - ');
        const [bStart] = b.label.split(' - ');
        const [aDay, aMonth] = aStart.split('/').map(Number);
        const [bDay, bMonth] = bStart.split('/').map(Number);
        const currentYear = new Date().getFullYear();
        const aDate = new Date(currentYear, aMonth - 1, aDay).getTime();
        const bDate = new Date(currentYear, bMonth - 1, bDay).getTime();
        return bDate - aDate;
      });
  }, [filteredJobs]);

  const monthlyGroups = useMemo<MonthlyGroup[]>(() => {
    const groups: Record<string, Job[]> = {};

    for (const job of filteredJobs) {
      const date = new Date(job.createdAt);
      const monthKey = getMonthKey(date);
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(job);
    }

    return Object.entries(groups)
      .map(([monthKey, monthJobs]) => {
        const sortedJobs = [...monthJobs].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const monthDate = new Date(sortedJobs[0].createdAt);
        const monthLabel = getMonthLabel(monthDate);
        const totalHoursValue = sortedJobs.reduce((sum, job) => sum + Number(job.hours || 0), 0);

        const weekTotals: Record<string, number> = {};
        const workerTotals: Record<string, number> = {};

        for (const job of sortedJobs) {
          const weekLabel = getWeekRangeLabel(new Date(job.createdAt));
          weekTotals[weekLabel] = (weekTotals[weekLabel] || 0) + Number(job.hours || 0);
          workerTotals[job.worker] = (workerTotals[job.worker] || 0) + Number(job.hours || 0);
        }

        const weeklyRowsForMonth = Object.entries(weekTotals).map(([label, totalHoursRow]) => ({
          label,
          totalHours: totalHoursRow,
        }));

        const workerRowsForMonth = Object.entries(workerTotals)
          .map(([label, totalHoursRow]) => ({
            label,
            totalHours: totalHoursRow,
          }))
          .sort((a, b) => b.totalHours - a.totalHours);

        return {
          monthKey,
          monthLabel,
          totalHours: totalHoursValue,
          jobs: sortedJobs,
          weeklyRows: weeklyRowsForMonth,
          workerRows: workerRowsForMonth,
        };
      })
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [filteredJobs]);

  const currentMonthLabel = useMemo(() => getMonthLabel(new Date()), []);

  const exportMonthToCsv = async (group: MonthlyGroup) => {
  try {
    const csvRows: string[] = [];

    csvRows.push(`Month,${escapeCsv(group.monthLabel)}`);
    csvRows.push(`Filter Worker,${escapeCsv(filterWorker)}`);
    csvRows.push('');

    csvRows.push('Worker Summary');
    csvRows.push('Worker,Total Hours');
    for (const row of group.workerRows) {
      csvRows.push(`${escapeCsv(row.label)},${row.totalHours}`);
    }
    csvRows.push('');
await
    csvRows.push('Weekly Summary');
    csvRows.push('Week Range,Total Hours');
    for (const row of group.weeklyRows) {
      csvRows.push(`${escapeCsv(row.label)},${row.totalHours}`);
    }
    csvRows.push('');

    csvRows.push('Job Cards');
    csvRows.push('Date,Time,Worker,Site,Hours,Description,Photo Count');

    for (const job of group.jobs) {
      csvRows.push(
        [
          escapeCsv(formatDate(job.createdAt)),
          escapeCsv(formatTime(job.createdAt)),
          escapeCsv(job.worker),
          escapeCsv(job.site),
          Number(job.hours || 0),
          escapeCsv(job.desc),
          job.photoUris.length,
        ].join(',')
      );
    }

    const fileName = `${group.monthLabel.replace(/[^\w-]+/g, '_')}_summary.csv`;
    const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, csvRows.join('\n'));

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    console.log('CSV file info:', fileInfo);

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      Alert.alert('Exported', `CSV saved to:\n${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Export ${group.monthLabel} CSV`,
      UTI: 'public.comma-separated-values-text',
    });
  } catch (error) {
    console.log('Error exporting CSV:', error);
    Alert.alert(
      'Export failed',
      error instanceof Error ? error.message : String(error)
    );
  }
};

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Australian Strapping{'\n'}Job Card
        </Text>

        <Text style={styles.sectionTitle}>Worker</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={worker} onValueChange={(value) => setWorker(value)} style={styles.picker}>
            {FORM_WORKERS.map((name) => (
              <Picker.Item key={name} label={name} value={name} />
            ))}
          </Picker>
        </View>

        <Text style={styles.sectionTitle}>Quick Site</Text>
        <View style={styles.optionRow}>
          {quickSites.map((siteName) => (
            <View key={siteName} style={styles.quickSiteWrapper}>
              <Pressable
                style={[
                  styles.optionButton,
                  site === siteName && styles.optionButtonSelected,
                ]}
                onPress={() => setSite(siteName)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    site === siteName && styles.optionButtonTextSelected,
                  ]}
                >
                  {siteName}
                </Text>
              </Pressable>

              <Pressable style={styles.quickDeleteBadge} onPress={() => deleteQuickSite(siteName)}>
                <Text style={styles.quickDeleteBadgeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Site Dropdown</Text>
        <View style={styles.pickerWrapper}>
          <Picker selectedValue={site} onValueChange={(value) => setSite(value)} style={styles.picker}>
            <Picker.Item label="Select a site..." value="" />
            {quickSites.map((siteName) => (
              <Picker.Item key={siteName} label={siteName} value={siteName} />
            ))}
          </Picker>
        </View>

        <TextInput
          placeholder="Or type site / customer"
          value={site}
          onChangeText={setSite}
          style={styles.input}
        />

        <TextInput
          placeholder="Hours worked"
          value={hours}
          onChangeText={setHours}
          style={styles.input}
          keyboardType="decimal-pad"
        />

        <TextInput
          placeholder="Work description / notes"
          value={desc}
          onChangeText={setDesc}
          style={[styles.input, styles.descriptionInput]}
          multiline
        />

        <View style={styles.buttonSpacing}>
          <Button title="Add Photos" onPress={pickImages} />
        </View>

        {photoUris.length > 0 ? (
          <View style={styles.photoPreviewCard}>
            <Text style={styles.sectionTitle}>Selected Photos ({photoUris.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {photoUris.map((uri) => (
                <View key={uri} style={styles.previewImageWrap}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <Pressable style={styles.removePhotoBadge} onPress={() => removeSelectedPhoto(uri)}>
                    <Text style={styles.removePhotoBadgeText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.formButtonRow}>
          <View style={styles.formButton}>
            <Button title="Add Job Card" onPress={addJob} />
          </View>
          <View style={styles.formButton}>
            <Button title="Clear Form" color="#666" onPress={clearForm} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Filter by Worker</Text>
        <View style={styles.optionRow}>
          {WORKERS.map((name) => (
            <Pressable
              key={name}
              style={[
                styles.optionButton,
                filterWorker === name && styles.optionButtonSelected,
              ]}
              onPress={() => setFilterWorker(name)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  filterWorker === name && styles.optionButtonTextSelected,
                ]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.summaryHeader} onPress={() => setSummaryExpanded((current) => !current)}>
          <Text style={styles.summaryHeaderText}>
            Summary {summaryExpanded ? '▲' : '▼'}
          </Text>
        </Pressable>

        {summaryExpanded ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>Visible job cards: {filteredJobs.length}</Text>
            <Text style={styles.summaryText}>Total visible hours: {totalHours}</Text>
            <Text style={styles.summaryText}>
              Hours today:{' '}
              {dailyRows[0]?.label === formatDate(new Date().toISOString()) ? dailyRows[0].totalHours : 0}
            </Text>

            <Text style={styles.summarySubheading}>Daily Totals</Text>
            {dailyRows.length > 0 ? (
              dailyRows.map((row) => (
                <Text key={row.label} style={styles.summaryLine}>
                  {row.label}: {row.totalHours}h
                </Text>
              ))
            ) : (
              <Text style={styles.summaryLine}>No data yet.</Text>
            )}

            <Text style={styles.summarySubheading}>Weekly Totals</Text>
            {weeklyRows.length > 0 ? (
              weeklyRows.map((row) => (
                <Text key={row.label} style={styles.summaryLine}>
                  {row.label}: {row.totalHours}h
                </Text>
              ))
            ) : (
              <Text style={styles.summaryLine}>No data yet.</Text>
            )}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Monthly Summaries</Text>
        {monthlyGroups.length > 0 ? (
          monthlyGroups.map((group) => {
            const expanded = monthlyExpanded[group.monthKey] ?? group.monthLabel === currentMonthLabel;

            return (
              <View key={group.monthKey} style={styles.monthCard}>
                <Pressable
                  style={styles.monthHeader}
                  onPress={() =>
                    setMonthlyExpanded((current) => ({
                      ...current,
                      [group.monthKey]: !expanded,
                    }))
                  }
                >
                  <View>
                    <Text style={styles.monthHeaderTitle}>{group.monthLabel} Summary</Text>
                    <Text style={styles.monthHeaderSub}>
                      {group.jobs.length} jobs · {group.totalHours}h
                    </Text>
                  </View>
                  <Text style={styles.monthChevron}>{expanded ? '▲' : '▼'}</Text>
                </Pressable>

                {expanded ? (
                  <View style={styles.monthBody}>
                    <Text style={styles.summarySubheading}>By Worker</Text>
                    {group.workerRows.map((row) => (
                      <Text key={`${group.monthKey}-${row.label}`} style={styles.summaryLine}>
                        {row.label}: {row.totalHours}h
                      </Text>
                    ))}

                    <Text style={styles.summarySubheading}>By Week</Text>
                    {group.weeklyRows.map((row) => (
                      <Text key={`${group.monthKey}-${row.label}`} style={styles.summaryLine}>
                        {row.label}: {row.totalHours}h
                      </Text>
                    ))}

                    <View style={styles.buttonSpacing}>
                      <Button title={`Export ${group.monthLabel} CSV`} onPress={() => exportMonthToCsv(group)} />
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No monthly summaries yet.</Text>
        )}

        <View style={styles.buttonSpacing}>
          <Button title="Clear All Job Cards" color="#b00020" onPress={clearAllJobs} />
        </View>

        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardSite}>{item.site}</Text>
              <Text style={styles.cardText}>Worker: {item.worker}</Text>
              <Text style={styles.cardText}>
                {formatDate(item.createdAt)} · {formatTime(item.createdAt)} · {item.hours}h
              </Text>
              <Text style={styles.cardText}>Work: {item.desc}</Text>

              {item.photoUris.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardImageScroll}>
                  {item.photoUris.map((uri) => (
                    <Image key={uri} source={{ uri }} style={styles.cardImage} />
                  ))}
                </ScrollView>
              ) : null}

              <Pressable style={styles.deleteButton} onPress={() => deleteJob(item.id)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No saved job cards yet.</Text>}
        />
      </View>
    </ScrollView>
  );
}

function escapeCsv(value: string | number) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 55,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 18,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  quickSiteWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  optionButtonSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },
  optionButtonTextSelected: {
    color: '#fff',
  },
  quickDeleteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#b00020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDeleteBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    lineHeight: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    padding: 12,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  buttonSpacing: {
    marginTop: 8,
    marginBottom: 8,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  formButton: {
    flex: 1,
  },
  photoPreviewCard: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
  },
  previewImageWrap: {
    position: 'relative',
    marginRight: 10,
  },
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 10,
    marginTop: 4,
  },
  removePhotoBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#b00020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  summaryHeader: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#111',
  },
  summaryHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  summaryCard: {
    marginTop: 10,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  summarySubheading: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  summaryLine: {
    fontSize: 14,
    marginBottom: 4,
  },
  monthCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    marginBottom: 10,
    overflow: 'hidden',
  },
  monthHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#efefef',
  },
  monthHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthHeaderSub: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
  },
  monthChevron: {
    fontSize: 16,
    fontWeight: '800',
  },
  monthBody: {
    padding: 12,
  },
  listContainer: {
    paddingTop: 10,
  },
  card: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  cardSite: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  cardText: {
    fontSize: 14,
    marginBottom: 3,
  },
  cardImageScroll: {
    marginTop: 10,
  },
  cardImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginRight: 10,
  },
  deleteButton: {
    marginTop: 10,
    backgroundColor: '#b00020',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 14,
    textAlign: 'center',
    color: '#666',
  },
});