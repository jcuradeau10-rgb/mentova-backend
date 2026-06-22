import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { courseAPI } from '../../utils/api';
import { useTranslation } from '../../store/languageStore';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 16) / 2;

interface Course {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail_url?: string;
  pro_name: string;
  category: string;
  difficulty: string;
  total_students: number;
  average_rating?: number;
  reviews_count?: number;
  modules_count?: number;
}

const CATEGORIES = [
  { id: 'all', labelKey: 'coursesList.all', icon: 'apps' },
  { id: 'crypto', label: 'Crypto', icon: 'logo-bitcoin' },
  { id: 'trading', label: 'Trading', icon: 'trending-up' },
  { id: 'defi', label: 'DeFi', icon: 'cube' },
  { id: 'nft', label: 'NFT', icon: 'images' },
  { id: 'blockchain', label: 'Blockchain', icon: 'git-network' },
];

const DIFFICULTIES = [
  { id: 'all', labelKey: 'coursesList.allLevels' },
  { id: 'beginner', labelKey: 'coursesList.beginner' },
  { id: 'intermediate', labelKey: 'coursesList.intermediate' },
  { id: 'advanced', labelKey: 'coursesList.advanced' },
];

export default function CourseCatalogScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');

  const loadCourses = async () => {
    try {
      const params: any = { limit: 50 };
      if (selectedCategory !== 'all') params.category = selectedCategory;
      if (selectedDifficulty !== 'all') params.difficulty = selectedDifficulty;
      if (searchQuery.trim()) params.search = searchQuery;

      const res = await courseAPI.browseCourses(params);
      if (res.data.success) {
        setCourses(res.data.data);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, [selectedCategory, selectedDifficulty]);

  const handleSearch = () => {
    setLoading(true);
    loadCourses();
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '#10B981';
      case 'intermediate': return '#F59E0B';
      case 'advanced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return t('coursesList.beginner');
      case 'intermediate': return t('coursesList.intermediate');
      case 'advanced': return t('coursesList.advanced');
      default: return difficulty;
    }
  };

  const renderCourseCard = (course: Course) => (
    <TouchableOpacity
      key={course.id}
      style={styles.courseCard}
      onPress={() => router.push(`/courses/${course.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.cardThumbnail}>
        {course.thumbnail_url ? (
          <Image source={{ uri: course.thumbnail_url }} style={styles.thumbnailImage} />
        ) : (
          <LinearGradient
            colors={['#7C3AED', '#6D28D9']}
            style={styles.thumbnailPlaceholder}
          >
            <Ionicons name="school" size={32} color="#FFF" />
          </LinearGradient>
        )}
        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(course.difficulty) }]}>
          <Text style={styles.difficultyText}>{getDifficultyLabel(course.difficulty)}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>
        <Text style={styles.cardAuthor}>par {course.pro_name}</Text>

        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="people" size={14} color="#9CA3AF" />
            <Text style={styles.metaText}>{course.total_students}</Text>
          </View>
          {course.average_rating && (
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.metaText}>{course.average_rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.cardPrice}>
            {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Gratuit'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0a1a', '#1a1a2e', '#0a0a1a']} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("coursesList.title")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder={t("coursesList.searchPlaceholder")}
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); handleSearch(); }}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          <View style={styles.categoriesContainer}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryBtn, selectedCategory === cat.id && styles.categoryBtnActive]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={18}
                  color={selectedCategory === cat.id ? '#FFF' : '#9CA3AF'}
                />
                <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Difficulty Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.difficultyScroll}>
          <View style={styles.difficultyContainer}>
            {DIFFICULTIES.map((diff) => (
              <TouchableOpacity
                key={diff.id}
                style={[styles.difficultyBtn, selectedDifficulty === diff.id && styles.difficultyBtnActive]}
                onPress={() => setSelectedDifficulty(diff.id)}
              >
                <Text style={[styles.difficultyBtnText, selectedDifficulty === diff.id && styles.difficultyBtnTextActive]}>
                  {diff.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Courses Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>{t("coursesList.loading")}</Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={64} color="#4B5563" />
            <Text style={styles.emptyTitle}>{t('coursesList.noCourseFound')}</Text>
            <Text style={styles.emptyText}>
              Essayez de modifier vos filtres ou votre recherche
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.coursesGrid}>
              {courses.map(renderCourseCard)}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  safeArea: { flex: 1 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    textAlign: 'center',
  },

  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFF',
  },

  categoriesScroll: {
    maxHeight: 50,
    marginBottom: 12,
  },
  categoriesContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  categoryTextActive: {
    color: '#FFF',
  },

  difficultyScroll: {
    maxHeight: 40,
    marginBottom: 16,
  },
  difficultyContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  difficultyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderRadius: 8,
  },
  difficultyBtnActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  difficultyBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  difficultyBtnTextActive: {
    color: '#A78BFA',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 16,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },

  scrollView: {
    flex: 1,
  },
  coursesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 16,
  },

  courseCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardThumbnail: {
    height: 120,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  difficultyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
    minHeight: 36,
  },
  cardAuthor: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
});
