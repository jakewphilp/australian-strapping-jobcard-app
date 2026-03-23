// LOCAL STORAGE - saves job data on the device for now
// Later this can be replaced with Supabase database calls
import AsyncStorage from '@react-native-async-storage/async-storage'; 

// IMAGE PICKER - allows user to select photos from their photo library
import * as ImagePicker from 'expo-image-picker';

// FILE SYSTEM - used to create and write CSV files to device storage
import * as FileSystem from 'expo-file-system';

// SHARING - allows user to export/share the generated CSV file
import * as Sharing from 'expo-sharing';

// DROPDOWN SELECTOR - used for worker and site selection drop down menus
import { Picker } from '@react-native-picker/picker';

// REACT HOOKS - state management and lifecycle control
import { useEffect, useMemo, useState } from 'react';

// UI COMPONENTS - building blocks of the app screen
import {

  Alert,	// POPUP ALERTS (errors, confirmations)

  Button, 	// BASIC BUTTON COMPONENT

  FlatList, 	// EFFICIENT LIST RENDERING (job cards)

  Image, 	// DISPLAY IMAGES (job photos)

  Pressable, 	// CUSTOM TOUCHABLE BUTTON (more control than button)

  ScrollView, 	// ALLOWS VERTICAL/HORIZONTAL SCROLLING

  StyleSheet,	// STYLING SYSTEM FOR COMPONENTS

  Text, 	// DISPLAY TEXT

  TextInput, 	// INPUT FIELDS (sites, hours, description)

  View, 	// CONTAINER LAYOUT COMPONENT

} from 'react-native';

// JOB TYPE - represents a single job card entry stored in the app
// This is the core data structure used for storage, display, and summaries
type Job = {

  id: string; 		// UNIQUE IDENTIFIER FOR EACH JOB (used for deleting/rendering)

  worker: string;	// WORKER ASSIGNED TO THE JOB

  site: string; 	// CUSTOMER OR SITE NAME

  hours: number; 	// NUMBER OF HOURS WORKED

  description: string;	// DESCRIPTION OF WORK COMPLETED

  createdAt: string; 	// ISO TIMESTAMP FOR WHEN JOB WAS CREATED

  photoUris: string[];	// LOCAL DEVICE URIs FOR ATTACHED PHOTOS

};

// SUMMARY ROW TYPE - used for grouping and calculating totals
// Can represent totals by worker, by week, or by other categories
type SummaryRow = {

  label: string; 	// NAME OF WORKER, WEEK, OR CATEGORY BEING SUMMARISED

  totalHours: number;	// TOTAL HOURS FOR THAT SUMMARY ROW

};

// MONTHLY GROUP TYPE - represents a full month of job data and summaries
// Contains all jobs for the month plus calculated breakdowns
type MonthlyGroup = {

  monthKey: string; 		// SORTABLE MONTH VALUE LIKE "03-2026"

  monthLabel: string;		// DISPLAY LABEL LIKE "March 2026"

  totalHours: number;		// TOTAL HOURS WORKED IN THAT MONTH

  jobs: Job[];			// ALL JOB CARDS THAT BELONG TO THAT MONTH

  weeklyRows: SummaryRow[]; 	// WEEKLY BREAKDOWN FOR THE MONTH

  workerRows: SummaryRow[]; 	// WORKER BREAKDOWN FOR THE MONTH

};

// STORAGE KEYS - unique names used to save and load local app data

const JOBS_STORAGE_KEY = 'philp-operations-job-cards'; 	// STORES ALL SAVED JOB CARDS

const SITES_STORAGE_KEY = 'philp-operations-quick-sites';	// STORES CUSTOM QUICK SITE OPTIONS

// WORKER LIST - all workers available in the app
const WORKERS = ['All', 'Terry', 'Jake', 'Luke', 'Zack', 'Robbie', 'Grace', 'Daniel', 'Other'];

// FORM WORKERS - workers list used in the job form only
// Excludes "All" because "All" is only for filtering, not for creating a job card
const FORM_WORKERS = WORKERS.filter((w) => w !== 'All');

// DEFAULT SITES - starter site options shown before custom sites are added
const DEFAULT_SITES = ['Home'];

// MAIN SCREEN COMPONENT - controls form input, saved jobs, quick sites, filters and summaries
export default function HomeScreen() {

  // FORM STATE - current values being entered into the job card form
  
  const [worker, setWorker] = useState('');			// CURRENT SELECTED WORKER FOR THE NEW JOB CARD

  const [site, setSite] = useState(''); 			// CURRENT SITE/CUSTOMER ENTERED IN THE FORM
	
  const [hours, setHours] = useState('');			// HOURS INPUT KEPT AS TEXT UNTIL CONVERTED WHEN SAVING

  const [description, setDescription] = useState('');		// DESCRIPTION OF WORK COMPLETED

  const [photoUris, setPhotoUris] = useState<string[]>([]); 	// SELECTED LOCAL PHOTO URIs FOR THE CURRENT FORM

  // STORED DATA STATE - saved app data loaded from AsyncStorage
  
  const [jobs, setJobs] = useState<Job[]>([]); 					// ALL SAVED JOB CARDS

  const [quickSites, setQuickSites] = useState<string[]>(DEFAULT_SITES);	// SAVED QUICK SITE OPTIONS

  // UI STATE - controls filtering and expand/collapse sections on screen 

  const [filterWorker, setFilterWorker] = useState('All'); 				// WORKER FILTER USED FOR VIEWING SAVED JOBS	
  
  const [summaryExpanded, setSummaryExpanded] = useState(true); 			// CONTROLS WHETHER SUMMARY SECTION IS OPEN 

  const [monthlyExpanded, setMonthlyExpanded] = useState<Record<string, boolean>>({}); 	// CONTROLS WHICH MONTH GROUPS ARE EXPANDED

  // INITIAL LOAD - runs once when the screen first opens
  useEffect(() => {
   loadData();
  }, []);

  // AUTO SAVE JOBS - saves jobs whenever the job array changes
  useEffect(() => {
    saveJobsToStorage();
  }, [jobs]);

  // AUTO SAVE QUICK SITES - saves quick sites whenver the quickSites array changes
  useEffect(() => {
    saveQuickSitesToStorage();
  }, [quickSites]);

  // LOAD DATA FROM STORAGE - restores saved jobs and quick sites from AsyncStorage
  const loadData = async () => {
    try {
      const savedJobs = await AsyncStorage.getItem(JOBS_STORAGE_KEY);
      const savedSites = await AsyncStorage.getItem(SITES_STORAGE_KEY);
      if (savedJobs) {
        const parsedJobs: Array<
          Job & {

            photoUri?: string; 	// FALLBACK SUPPORT - for older single-photo version

            desc?: string;	// FALLBACK SUPPORT - for older description field name

          }
        > = JSON.parse(savedJobs);
        const cleanedJobs: Job[] = parsedJobs.map((job) => ({	
          ...job, 
          
          hours: Number(job.hours) || 0, 			// ENSURES HOURS IS ALWAYS STORED AS A NUMBER

          description: job.description ?? job.desc ?? '', 	// SUPPORTS OLD "desc" FIELD IF IT EXISTS

          photoUris: Array.isArray(job.photoUris)
            ? job.photoUris
            : job.photoUri
              ? [job.photoUri]
              : [], 						// SUPPORTS OLD SINGLE PHOTO VERSION
        }));

        setJobs(cleanedJobs);

      }
      if (savedSites) {
        const parsedSites: string[] = JSON.parse(savedSites);
        setQuickSites(parsedSites.length > 0 ? parsedSites : DEFAULT_SITES);
      }
    } catch (error) {
      console.log('Error loading data:', error);
    }
  };

  // SAVE JOBS TO STORAGE - stores the current jobs array in AsyncStorage
  const saveJobsToStorage = async () => {
    try {
      await AsyncStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
    } catch (error) {
      console.log('Error saving jobs:', error);
    }
  };

  // SAVE QUICK SITES TO STORAGE - stores the current quick sites array in AsyncStorage
  const saveQuickSitesToStorage = async () => {
    try {
      await AsyncStorage.setItem(SITES_STORAGE_KEY, JSON.stringify(quickSites));
    } catch (error) {
      console.log('Error saving quick sites:', error);
    }
  };

  // ADD QUICK SITE IF NEEDED - saves a new site into quick sites if it does not already exist 
  const addQuickSiteIfNeeded = (siteName: string) => {
    const trimmed = siteName.trim();
    if (!trimmed) return;
    const exists = quickSites.some((s) => s.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      setQuickSites((current) => [...current, trimmed]);
    }
  };

  // CLEAR FORM - resets the job entry form back to default values after saving 
  const clearForm = () => {
    setWorker('');
    setSite('');
    setHours('');
    setDescription('');
    setPhotoUris([]);
  };

  // PICK IMAGES - opens the users photo library and adds selected images to the current form
  const pickImages = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access to add images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
              merged.push(uri); // PREVENTS DUPLICATE PHOTOS BEING ADDED
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

  // REMOVE SELECTED PHOTO - removes one photo from the current form before saving the job 
  const removeSelectedPhoto = (uriToRemove: string) => {
    setPhotoUris((current) => current.filter((uri) => uri !== uriToRemove));
  };

  // ADD JOB - validates form input, creates a new job card, saves it to state, and clears the form 
  const addJob = () => {
    const trimmedSite = site.trim();
    const trimmedHours = hours.trim();
    const trimmedDescription = description.trim();
    if (!worker || !trimmedSite || !trimmedHours || !trimmedDescription) {
      Alert.alert('Missing details', 'Please complete all fields.');
      return;
    }
    const parsedHours = Number(trimmedHours);
    if (Number.isNaN(parsedHours) || parsedHours <= 0) {
      Alert.alert('Invalid hours', 'Please enter a valid number of hours.');
      return;
    }
    const newJob: Job = {

      id: Date.now().toString(), 	// TEMPORARY UNIQUE ID BASED ON CURRENT TIMESTAMP
      worker, 
      site: trimmedSite,
      hours: parsedHours, 
      description: trimmedDescription, 
      createdAt: new Date().toISOString(), 
      photoUris, 
    };

    setJobs((current) => [newJob, ...current]); 	// ADDS NEWEST JOB TO THE TOP OF THE LIST 

    addQuickSiteIfNeeded(trimmedSite); 			// SAVES SITE INTO QUICK SITES IF IT IS NEW

    clearForm(); 					// RESETS THE FORM AFTER SUCCESSFUL SAVE
  };

  // DELETE JOB - removes a saved job card after confirmation 
  const deleteJob = (id: string) => {
    Alert.alert('Confirm delete', 'Are you sure you want to delete this job card?', 
    [
      { text: 'Cancel', style: 'cancel' }, 
      {
        text: 'Delete', 
        style:'destructive',
        onPress: () => {
          setJobs((current) => current.filter((job) => job.id !==id));
        }, 
      },
    ]
    );
  };

  // DELETE QUICK SITE - removes a saved quick site after confirmation 
  const deleteQuickSite = (siteName: string) => {
    Alert.alert('Delete quick site', `Remove "${siteName}" from quick sites?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', 
        style: 'destructive',
        onPress: () => {
          setQuickSites((current) => current.filter((s) => s !== siteName));
          if (site === siteName) {

            setSite(''); 	// CLEARS CURRENT SITE INPUT IF THE DELETED QUICK SITE WAS SELECTED
          }
        },
      },
    ]);
  };

  // CLEAR ALL JOBS - asks for confirmation, then deletes every saved job card
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

  // FILTERED JOBS - returns either all jobs or only jobs for the selected worker filter
  const filteredJobs = useMemo(() => {
    if (filterWorker === 'All') return jobs;
    return jobs.filter((job) => job.worker === filterWorker);
  }, [jobs, filterWorker]);

  // FORMAT DATE - converts an ISO date string into Australian date format
  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleDateString('en-AU');
  };

  // FORMAT TIME - converts an ISO date string into 12 hour time with am/pm
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours === 0 ? 12 : hours;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minStr} ${ampm}`;
  };

  // FORMAT SHORT DATE - used for compact labels like weekly ranges (e.g. 24/03)
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  // FORMAT FULL DATE - reusable helper for full Australian date display
  const formatDateFull = (date: Date) => {
    return date.toLocaleDateString('en-AU');
  };

  // GET MONDAY - returns the Monday of the week for a given date
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; 	// Sunday becomes previous Monday
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + diff);
    return d;
  };

  // GET SUNDAY - returns the Sunday of the same week for a given date
  const getSunday = (date: Date) => {
    const monday = getMonday(date);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  // GET WEEK RANGE LABEL - creates a readable week label like "24/03 - 30/03"
  const getWeekRangeLabel = (dateInput: Date) => {
    const monday = getMonday(dateInput);
    const sunday = getSunday(dateInput);
    return `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
  };

  // GET MONTH LABEL - creates a readable month label like "March 2026"
  const getMonthLabel = (dateInput: Date) => {
    return dateInput.toLocaleDateString('en-AU', {
      month: 'long',
      year: 'numeric',
    });
  };

  // GET MONTH KEY - creates a sortable month key like "2026-03"
  const getMonthKey = (dateInput: Date) => {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  };

  // TOTAL HOURS - calculates the total visible hours based on the active worker filter
  const totalHours = useMemo(() => {
    return filteredJobs.reduce((sum, job) => sum + job.hours, 0);
  }, [filteredJobs]);

  // DAILY ROWS - groups visible jobs by day and totals the hours for each day
  const dailyRows = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const job of filteredJobs) {
      const label = formatDate(job.createdAt);
      totals[label] = (totals[label] || 0) + job.hours;
    }
    return Object.entries(totals)
      .map(([label, totalHoursValue]) => ({
        label,
        totalHours: totalHoursValue,
        sortDate: new Date(label.split('/').reverse().join('-')).getTime(),
      }))
      .sort((a, b) => b.sortDate - a.sortDate);
  }, [filteredJobs]);

  // WEEKLY ROWS - groups visible jobs by week range and totals the hours for each week
  const weeklyRows = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const job of filteredJobs) {
      const label = getWeekRangeLabel(new Date(job.createdAt));
      totals[label] = (totals[label] || 0) + job.hours;
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

  // MONTHLY GROUPS - builds month-by-month summaries including totals by week and by worker
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
        const totalHoursValue = sortedJobs.reduce((sum, job) => sum + job.hours, 0);
        const weekTotals: Record<string, number> = {};
        const workerTotals: Record<string, number> = {};
        for (const job of sortedJobs) {
          const weekLabel = getWeekRangeLabel(new Date(job.createdAt));
          weekTotals[weekLabel] = (weekTotals[weekLabel] || 0) + job.hours;
          workerTotals[job.worker] = (workerTotals[job.worker] || 0) + job.hours;
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

  // CURRENT MONTH LABEL - used to auto-expand the current month summary by default
  const currentMonthLabel = useMemo(() => getMonthLabel(new Date()), []);

  // EXPORT MONTH TO CSV - creates a CSV file for one monthly summary and opens sharing
  const exportMonthToCsv = async (group: MonthlyGroup) => {
    try {
      const csvRows: string[] = [];
      
      // HEADER INFO
      csvRows.push(`Month,${escapeCsv(group.monthLabel)}`);
      csvRows.push(`Filter Worker,${escapeCsv(filterWorker)}`);
      csvRows.push('');

      // WORKER SUMMARY
      csvRows.push('Worker Summary');
      csvRows.push('Worker,Total Hours');
      for (const row of group.workerRows) {
        csvRows.push(`${escapeCsv(row.label)},${row.totalHours}`);
      }
      csvRows.push('');

      // WEEKLY SUMMARY
      csvRows.push('Weekly Summary');
      csvRows.push('Week Range,Total Hours');
      for (const row of group.weeklyRows) {
        csvRows.push(`${escapeCsv(row.label)},${row.totalHours}`);
      }
      csvRows.push('');

      // JOB CARD DETAIL
      csvRows.push('Job Cards');
      csvRows.push('Date,Time,Worker,Site,Hours,Description,Photo Count');
      for (const job of group.jobs) {
        csvRows.push(
          [
            escapeCsv(formatDate(job.createdAt)),
            escapeCsv(formatTime(job.createdAt)),
            escapeCsv(job.worker),
            escapeCsv(job.site),
            job.hours,
            escapeCsv(job.description),
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
          PHILPY & SONS {'\n'}JOB CARD
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
          value={description}
          onChangeText={setDescription}
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
              <Text style={styles.cardText}>Work: {item.description}</Text>
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

// ESCAPE CSV - wraps values in quotes and escapes internal quotes for safe CSV export
function escapeCsv(value: string | number) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

// STYLES - visual layout and formatting for the job card screen
const styles = StyleSheet.create({
  // OUTER SCROLL AREA - adds space at the bottom so content does not feel cramped
  scrollContainer: {
    paddingBottom: 40,
  },

  // MAIN SCREEN CONTAINER - controls page padding and background
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 55,
    backgroundColor: '#ffffff',
  },

  // APP TITLE - large heading shown at the top of the screen
  title: {
    fontSize: 48,
    fontWeight: '900',
    marginBottom: 18,
    textAlign: 'center',
  },

  // SECTION TITLE - used above form fields and grouped content areas
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },

  // PICKER WRAPPER - border and shape around dropdown menus
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 10,
    overflow: 'hidden',
  },

  // PICKER - full width dropdown control
  picker: {
    width: '100%',
  },

  // OPTION ROW - wraps quick site and worker filter buttons across multiple lines
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },

  // QUICK SITE WRAPPER - holds each quick site button and its delete badge
  quickSiteWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },

  // OPTION BUTTON - shared style for quick site and worker filter buttons
  optionButton: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },

  // SELECTED OPTION BUTTON - darker style for the currently active choice
  optionButtonSelected: {
    backgroundColor: '#111',
    borderColor: '#111',
  },

  // OPTION BUTTON TEXT - standard text inside quick site and filter buttons
  optionButtonText: {
    fontSize: 14,
    color: '#111',
    fontWeight: '600',
  },

  // SELECTED OPTION TEXT - white text used on dark selected buttons
  optionButtonTextSelected: {
    color: '#fff',
  },

  // QUICK DELETE BADGE - small red "x" badge shown on quick site buttons
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

  // QUICK DELETE BADGE TEXT - text inside the quick site delete badge
  quickDeleteBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    lineHeight: 14,
  },

  // TEXT INPUT - shared style for site, hours, and description fields
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

  // DESCRIPTION INPUT - taller multiline field for job notes / work details
  descriptionInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },

  // BUTTON SPACING - vertical spacing around standalone button sections
  buttonSpacing: {
    marginTop: 8,
    marginBottom: 8,
  },

  // FORM BUTTON ROW - holds side-by-side form action buttons
  formButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 8,
  },

  // FORM BUTTON - makes each form button fill half the row
  formButton: {
    flex: 1,
  },

  // PHOTO PREVIEW CARD - box around selected image previews before saving
  photoPreviewCard: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
  },

  // PREVIEW IMAGE WRAP - container for each preview image and its remove badge
  previewImageWrap: {
    position: 'relative',
    marginRight: 10,
  },

  // PREVIEW IMAGE - selected image thumbnail shown before saving the job
  previewImage: {
    width: 140,
    height: 140,
    borderRadius: 10,
    marginTop: 4,
  },

  // REMOVE PHOTO BADGE - small red badge used to remove a selected photo
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

  // REMOVE PHOTO BADGE TEXT - text inside the selected photo remove badge
  removePhotoBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },

  // SUMMARY HEADER - clickable summary section bar
  summaryHeader: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#111',
  },

  // SUMMARY HEADER TEXT - text inside the expandable summary bar
  summaryHeaderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },

  // SUMMARY CARD - content box for totals, daily rows, and weekly rows
  summaryCard: {
    marginTop: 10,
    marginBottom: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: '#ddd',
    backgroundColor: '#f5f5f5',
  },

  // SUMMARY TEXT - main summary figures like visible jobs and total hours
  summaryText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },

  // SUMMARY SUBHEADING - labels for grouped summary sections
  summarySubheading: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },

  // SUMMARY LINE - individual daily, weekly, or worker summary rows
  summaryLine: {
    fontSize: 14,
    marginBottom: 4,
  },

  // MONTH CARD - wrapper for each expandable monthly summary
  monthCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
    marginBottom: 10,
    overflow: 'hidden',
  },

  // MONTH HEADER - top bar for each monthly summary card
  monthHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#efefef',
  },

  // MONTH HEADER TITLE - main month name text
  monthHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },

  // MONTH HEADER SUBTEXT - smaller summary below the month title
  monthHeaderSub: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
  },

  // MONTH CHEVRON - expand/collapse arrow on monthly cards
  monthChevron: {
    fontSize: 16,
    fontWeight: '800',
  },

  // MONTH BODY - expanded content area inside each monthly summary
  monthBody: {
    padding: 12,
  },

  // LIST CONTAINER - spacing above the saved job card list
  listContainer: {
    paddingTop: 10,
  },

  // JOB CARD - wrapper for each saved job entry
  card: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },

  // JOB CARD SITE - main bold site/customer heading on each job card
  cardSite: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },

  // JOB CARD TEXT - standard detail text inside each job card
  cardText: {
    fontSize: 14,
    marginBottom: 3,
  },

  // JOB CARD IMAGE SCROLL - horizontal image strip inside a saved job card
  cardImageScroll: {
    marginTop: 10,
  },

  // JOB CARD IMAGE - saved photo preview inside a job card
  cardImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginRight: 10,
  },

  // DELETE BUTTON - red button used to remove a saved job card
  deleteButton: {
    marginTop: 10,
    backgroundColor: '#b00020',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },

  // DELETE BUTTON TEXT - text shown inside the delete button
  deleteButtonText: {
    color: '#fff',
    fontWeight: '700',
  },

  // EMPTY TEXT - shown when there are no saved jobs or no summary data
  emptyText: {
    marginTop: 14,
    textAlign: 'center',
    color: '#666',
  },
});
