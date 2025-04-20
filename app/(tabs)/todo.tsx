import React from 'react';
import 'react-native-reanimated'; // 👈 must be FIRST import
import { Menu } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../supabase';
import { User } from '@supabase/supabase-js';
import { Session } from '@supabase/supabase-js';
import { useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Check, ChevronDown, ChevronUp, Plus, X, Calendar, Trash2, Repeat, Menu as MenuIcon } from 'lucide-react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useBottomSheetDynamicSnapPoints } from '@gorhom/bottom-sheet';
import { PanGestureHandler, GestureHandlerRootView, State, Swipeable } from 'react-native-gesture-handler';
import styles from '../../styles/todo.styles';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useSession } from '../../hooks/useSession';


type RepeatOption = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
type WeekDay = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

const REPEAT_OPTIONS = [
  { value: 'none' as const, label: "Don't repeat" },
  { value: 'daily' as const, label: 'Daily' },
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
  { value: 'custom' as const, label: 'Custom' },
];

type RepeatUnit = 'days' | 'weeks' | 'months';

const REPEAT_UNITS: { value: RepeatUnit; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
];

const WEEK_DAYS: { value: WeekDay; label: string; shortLabel: string }[] = [
  { value: 'sun', label: 'Sunday', shortLabel: 'S' },
  { value: 'mon', label: 'Monday', shortLabel: 'M' },
  { value: 'tue', label: 'Tuesday', shortLabel: 'T' },
  { value: 'wed', label: 'Wednesday', shortLabel: 'W' },
  { value: 'thu', label: 'Thursday', shortLabel: 'T' },
  { value: 'fri', label: 'Friday', shortLabel: 'F' },
  { value: 'sat', label: 'Saturday', shortLabel: 'S' },
];

const THEMES = {
  pastel: ['#FADADD', '#FFE5B4', '#FFFACD', '#D0F0C0', '#B0E0E6', '#D8BFD8', '#F0D9FF', '#C1E1C1']
,
  forest: ['#4B6B43', '#7A9D54', '#A7C957', '#DDE26A', '#B49F73', '#856D5D', '#5C4033', '#E4D6A7'],

  dreamscape: ['#E0F7FA', '#E1F5FE', '#D1C4E9', '#F3E5F5', '#F0F4C3', '#D7CCC8', '#C5CAE9', '#E8EAF6'],
  
  coastal: ['#A7D7C5', '#CFE8E0', '#BFDCE5', '#8AC6D1', '#DCE2C8', '#F1F6F9', '#A2C4C9', '#F7F5E6']
,

  autumnglow: ['#FFB347', '#D2691E', '#FFD700', '#B22222', '#CD853F', '#FFA07A', '#8B4513', '#F4A460']
,

  cosmicjelly: ['#F15BB5', '#FEE440', '#00BBF9', '#00F5D4', '#FF99C8', '#FCF6BD', '#D0F4DE', '#E4C1F9'], 
bloom: ['#FF69B4', '#FFD700', '#7FFF00', '#FF8C00', '#00CED1', '#BA55D3', '#FFA07A', '#40E0D0']
,

vintagepicnic: ['#F67280', '#C06C84', '#F8B195', '#355C7D', '#6C5B7B', '#FDCB82', '#99B898', '#FF847C']
};


interface Category {
  id: string;
  label: string;
  color: string;
}

interface Todo {
  id: string;
  text: string;
  description?: string;
  completed: boolean;
  categoryId: string;
  date: Date;
  repeat?: RepeatOption;
  customRepeatFrequency?: number; 
  customRepeatUnit?: 'days' | 'weeks' | 'months'; 
  customRepeatWeekDays?: WeekDay[];
  repeatEndDate?: Date | null;  // 🔥 ADD THIS
}

function darkenColor(hex: string, amount = 0.2): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - 255 * amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - 255 * amount);
  const b = Math.max(0, (num & 0x0000FF) - 255 * amount);

  return (
    '#' +
    [r, g, b]
      .map((c) => Math.round(c).toString(16).padStart(2, '0'))
      .join('')
  );
}

export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#E3F2FD');
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hasTriggeredSwipeHaptic, setHasTriggeredSwipeHaptic] = useState(false);
  const [selectedRepeat, setSelectedRepeat] = useState<RepeatOption>('none');
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const repeatBottomSheetRef = useRef<BottomSheet>(null);
  const [unitMenuVisible, setUnitMenuVisible] = useState(false);
  const [taskDate, setTaskDate] = useState<Date | null>(null);
  const [showTaskDatePicker, setShowTaskDatePicker] = useState(false);
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(null);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof THEMES>('pastel');
  const [customRepeatFrequency, setCustomRepeatFrequency] = useState('1');
  const [customRepeatUnit, setCustomRepeatUnit] = useState<'days' | 'weeks' | 'months'>('days');
  const [selectedWeekDays, setSelectedWeekDays] = useState<WeekDay[]>([]);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const editBottomSheetRef = useRef<BottomSheet>(null);
  const initialSnapPoints = ['CONTENT_HEIGHT'];
  const { animatedHandleHeight, animatedSnapPoints, animatedContentHeight, handleContentLayout } =
    useBottomSheetDynamicSnapPoints(initialSnapPoints);
  const [swipingTodoId, setSwipingTodoId] = useState<string | null>(null);

  const resetForm = () => {
    setNewTodo('');
    setNewDescription('');
    setSelectedCategoryId('');
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setNewCategoryColor('#E3F2FD');
  };

  async function scheduleReminderNotification(taskTitle: string, reminderTime: Date) {
    try {
      const secondsUntilReminder = Math.floor((reminderTime.getTime() - Date.now()) / 1000);
      console.log('Scheduling notification in', secondsUntilReminder, 'seconds');
  
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Reminder",
          body: taskTitle,
          sound: true,
        },
        trigger: {
          type: 'timeInterval',
          seconds: secondsUntilReminder,
          repeats: false,
        } as Notifications.TimeIntervalTriggerInput,
      });
  
      console.log('✅ Notification scheduled!');
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
    }
  }

  const toggleWeekDay = (day: WeekDay) => {
    setSelectedWeekDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day]
    );
  };
  
  
  async function requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log('Notification permission status:', status); 
    if (status !== 'granted') {
      alert('Permission for notifications not granted!');
    }
  }

  const renderCustomRepeatSection = () => (
    <View style={styles.customRepeatContainer}>
      <View style={styles.customRepeatInputContainer}>
        <Text style={styles.everyText}>Every</Text>
        
        <TextInput
          style={styles.customRepeatInput}
          value={customRepeatFrequency}
          onChangeText={(text) => {
            const number = text.replace(/[^0-9]/g, '');
            if (number === '' || parseInt(number, 10) > 0) {
              setCustomRepeatFrequency(number);
            }
          }}
          keyboardType="numeric"
          placeholder="1"
          placeholderTextColor="#A3A3A3"
        />
        
        <Menu
          visible={unitMenuVisible}
          onDismiss={() => setUnitMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.unitSelector}
              onPress={() => setUnitMenuVisible(true)}
            >
              <Text style={styles.unitSelectorText}>
                {REPEAT_UNITS.find((unit) => unit.value === customRepeatUnit)?.label}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
          }
        >
          {REPEAT_UNITS.map((unit) => (
            <Menu.Item
              key={unit.value}
              onPress={() => {
                setCustomRepeatUnit(unit.value);
                setUnitMenuVisible(false);   // close after selecting ✅
              }}
              title={unit.label}
            />
          ))}
        </Menu>
      </View>
  
      {customRepeatUnit === 'weeks' && (
        <View style={styles.weekDaysContainer}>
          <Text style={styles.weekDaysTitle}>Repeat on</Text>
          <View style={styles.weekDayButtons}>
            {WEEK_DAYS.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.weekDayButton,
                  selectedWeekDays.includes(day.value) && styles.selectedWeekDayButton,
                ]}
                onPress={() => toggleWeekDay(day.value)}
              >
                <Text
                  style={[
                    styles.weekDayButtonText,
                    selectedWeekDays.includes(day.value) && styles.selectedWeekDayButtonText,
                  ]}
                >
                  {day.shortLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
  


  const handleSave = async () => {
    if (!newTodo.trim()) return;
  
    let finalCategoryId = selectedCategoryId;
  
    if (showNewCategoryInput && newCategoryName.trim()) {
      const newCategory = {
        id: Date.now().toString(),
        label: newCategoryName.trim(),
        color: newCategoryColor,
      };
      setCategories(prev => [...prev, newCategory]);
      finalCategoryId = newCategory.id;

      // Save new category to Supabase if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('categories')
          .insert({
            id: newCategory.id,
            label: newCategory.label,
            color: newCategory.color,
            user_id: user.id
          });
        
        if (error) {
          console.error('Error saving category:', error);
        }
      }
    }
  
    const newTodoItem: Todo = {
      id: Date.now().toString(),
      text: newTodo.trim(),
      description: newDescription.trim(),
      completed: false,
      categoryId: finalCategoryId,
      date: taskDate || currentDate,
      repeat: selectedRepeat,
      customRepeatFrequency: selectedRepeat === 'custom' ? Number(customRepeatFrequency) : undefined,
      customRepeatUnit: selectedRepeat === 'custom' ? customRepeatUnit : undefined,
      customRepeatWeekDays: selectedRepeat === 'custom' && customRepeatUnit === 'weeks' ? selectedWeekDays : undefined,
      repeatEndDate: selectedRepeat !== 'none' ? repeatEndDate : undefined,
    };
    
    setTodos(prev => [...prev, newTodoItem]);
    
    // Save task to Supabase if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('todos')
        .insert({
          id: newTodoItem.id,
          text: newTodoItem.text,
          description: newTodoItem.description,
          completed: newTodoItem.completed,
          category_id: newTodoItem.categoryId,
          date: newTodoItem.date.toISOString(),
          repeat: newTodoItem.repeat,
          custom_repeat_frequency: newTodoItem.customRepeatFrequency,
          custom_repeat_unit: newTodoItem.customRepeatUnit,
          custom_repeat_week_days: newTodoItem.customRepeatWeekDays,
          repeat_end_date: newTodoItem.repeatEndDate?.toISOString(),
          user_id: user.id
        });
      
      if (error) {
        console.error('Error saving task:', error);
      }
    }
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    if (reminderTime) {
      await scheduleReminderNotification(newTodo.trim(), reminderTime);
    }

    resetForm();
    bottomSheetRef.current?.close();
  };
  
  

  const handleEditSave = async () => {
    if (editingTodo && newTodo.trim()) {
      const updatedTodo = {
        ...editingTodo,
        text: newTodo,
        description: newDescription,
        categoryId: selectedCategoryId,
        date: taskDate || new Date(),
        repeat: selectedRepeat,
        repeatEndDate,
        customRepeatFrequency: Number(customRepeatFrequency),
        customRepeatUnit,
        customRepeatWeekDays: selectedWeekDays,
      };
  
      setTodos(prev =>
        prev.map(todo => (todo.id === editingTodo.id ? updatedTodo : todo))
      );
  
      // If a new category was added
      if (showNewCategoryInput && newCategoryName.trim()) {
        const newCategory = {
          id: Date.now().toString(),
          label: newCategoryName.trim(),
          color: newCategoryColor,
        };
        setCategories(prev => [...prev, newCategory]);

        // Save new category to Supabase if user is logged in
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('categories')
            .insert({
              id: newCategory.id,
              label: newCategory.label,
              color: newCategory.color,
              user_id: user.id
            });
          
          if (error) {
            console.error('Error saving category:', error);
          }
        }
      }

      // Update task in Supabase if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('todos')
          .update({
            text: updatedTodo.text,
            description: updatedTodo.description,
            category_id: updatedTodo.categoryId,
            date: updatedTodo.date.toISOString(),
            repeat: updatedTodo.repeat,
            custom_repeat_frequency: updatedTodo.customRepeatFrequency,
            custom_repeat_unit: updatedTodo.customRepeatUnit,
            custom_repeat_week_days: updatedTodo.customRepeatWeekDays,
            repeat_end_date: updatedTodo.repeatEndDate?.toISOString(),
          })
          .eq('id', updatedTodo.id)
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error updating task:', error);
        }
      }
  
      setEditingTodo(null);
      resetForm();
      editBottomSheetRef.current?.close();
    }
  };
  
  const toggleTodo = async (id: string) => {
    const updatedTodos = todos.map(todo =>
      todo.id === id
        ? { ...todo, completed: !todo.completed }
        : todo
    );
    setTodos(updatedTodos);

    // Update task in Supabase if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todos.find(t => t.id === id)?.completed })
        .eq('id', id)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error updating task completion:', error);
      }
    }
  };

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
  
    const fullDate = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  
    let relativeDay = '';
    if (isSameDay(date, today)) {
      relativeDay = 'Today';
    } else if (isSameDay(date, tomorrow)) {
      relativeDay = 'Tomorrow';
    } else if (isSameDay(date, yesterday)) {
      relativeDay = 'Yesterday';
    }
  
    return (
      <View style={{ alignItems: 'center' }}>
        <Text style={styles.dateText}>
          {fullDate}
        </Text>
        {relativeDay !== '' && (
          <Text style={styles.relativeDayText}>
            {relativeDay}
          </Text>
        )}
      </View>
    );
  };
  
  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const doesTodoBelongToday = (todo: Todo, date: Date) => {
    const taskDate = new Date(todo.date);
  
    if (isSameDay(taskDate, date)) return true; // normal case (non-repeat)
  
    if (todo.repeat === 'daily') {
      return date >= taskDate; // repeat daily after taskDate
    }
  
    if (todo.repeat === 'weekly') {
      return date >= taskDate && taskDate.getDay() === date.getDay();
    }
  
    if (todo.repeat === 'monthly') {
      return date >= taskDate && taskDate.getDate() === date.getDate();
    }
  
    if (todo.repeat === 'custom') {
      if (!todo.customRepeatFrequency || !todo.customRepeatUnit) return false;
  
      const diffInDays = Math.floor((date.getTime() - taskDate.getTime()) / (1000 * 60 * 60 * 24));
  
      if (todo.customRepeatUnit === 'days') {
        return diffInDays % todo.customRepeatFrequency === 0 && diffInDays >= 0;
      }
  
      if (todo.customRepeatUnit === 'weeks') {
        const weeksDiff = Math.floor(diffInDays / 7);
        const dayOfWeek = date.getDay();
        return weeksDiff % todo.customRepeatFrequency === 0 &&
               todo.customRepeatWeekDays?.includes(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][dayOfWeek] as WeekDay);
      }
  
      if (todo.customRepeatUnit === 'months') {
        const monthsDiff = (date.getFullYear() - taskDate.getFullYear()) * 12 + (date.getMonth() - taskDate.getMonth());
        return monthsDiff % todo.customRepeatFrequency === 0 && taskDate.getDate() === date.getDate();
      }
    }
  
    return false;
  };

  const todayTodos = todos.filter(todo => doesTodoBelongToday(todo, currentDate));


  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const goToNextDay = () => {
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    setCurrentDate(nextDate);
  };
  
  const goToPreviousDay = () => {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    setCurrentDate(prevDate);
  };

  const renderTodoItem = (todo: Todo) => {
    const handleDelete = () => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setTodos(prev => prev.filter(t => t.id !== todo.id));
    };
  
    const renderRightActions = (_: any, dragX: any, swipeAnimatedValue: any) => {
      const category = categories.find(c => c.id === todo.categoryId);
      const baseColor = category?.color || '#FF3B30';
      const darkColor = darkenColor(baseColor);
  
      return (
        <View style={[styles.rightAction, { backgroundColor: darkColor }]}>
          <TouchableOpacity onPress={handleDelete} style={styles.trashIconContainer}>
            <Trash2 color="white" size={20} />
          </TouchableOpacity>
        </View>
      );
    };
  
    const taskTouchable = (
      <TouchableOpacity
        style={[
          styles.todoItem,
          todo.completed && styles.completedTodo,
        ]}
        onPress={() => toggleTodo(todo.id)}
        onLongPress={() => {
          if (todo.completed) return;
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          setEditingTodo(todo);
          setNewTodo(todo.text);
          setNewDescription(todo.description || '');
          setSelectedCategoryId(todo.categoryId);
          editBottomSheetRef.current?.expand();
        }}
        delayLongPress={300}
        activeOpacity={0.9}
      >
        <View style={[styles.checkbox, todo.completed && styles.checked]}>
          {todo.completed && <Check size={16} color="white" />}
        </View>
        <View style={styles.todoContent}>
          <Text style={[styles.todoText, todo.completed && styles.completedText]}>
            {todo.text}
          </Text>
          {todo.description && (
            <Text style={styles.todoDescription}>{todo.description}</Text>
          )}
        </View>
      </TouchableOpacity>
    );

    return (
      <Swipeable
        key={todo.id}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={() => setSwipingTodoId(todo.id)}
        onSwipeableClose={() => {
          requestAnimationFrame(() => {
            setSwipingTodoId(null);
          });
        }}        
        onSwipeableOpen={handleDelete}
        friction={1.5}
        overshootRight={false}
        rightThreshold={30}
      >
        {swipingTodoId === todo.id ? (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {taskTouchable}
          </View>
        ) : (
          taskTouchable
        )}
      </Swipeable>
    );
  };
  
  const renderCategory = (category: Category, todayTodos: Todo[]) => {
    const categoryTodos = todayTodos.filter((todo) => todo.categoryId === category.id && !todo.completed);
  
    if (categoryTodos.length === 0) return null;

    const isCollapsed = collapsedCategories[category.id];

    const handleDeleteCategory = () => {
      // Remove all todos in this category
      setTodos(prev => prev.filter(todo => todo.categoryId !== category.id));
      // Remove the category
      setCategories(prev => prev.filter(c => c.id !== category.id));
      // Remove from collapsed state
      const newCollapsed = { ...collapsedCategories };
      delete newCollapsed[category.id];
      setCollapsedCategories(newCollapsed);
    };

    return (
      <View key={category.id} style={styles.categoryContainer}>
        <TouchableOpacity 
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse(category.id)}
          onLongPress={() => {
            Alert.alert(
              "Delete Category",
              `Are you sure you want to delete "${category.label}"? This will also delete all tasks in this category.`,
              [
                {
                  text: "Cancel",
                  style: "cancel"
                },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: handleDeleteCategory
                }
              ]
            );
          }}
          delayLongPress={500}
        >
          <Text style={styles.categoryTitle}>{category.label}</Text>
          {isCollapsed ? (
            <ChevronUp size={20} color="#666" />
          ) : (
            <ChevronDown size={20} color="#666" />
          )}
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: category.color }]}>
            {categoryTodos.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };

  const renderUncategorizedTodos = (todayTodos: Todo[]) => {
    const uncategorizedTodos = todayTodos.filter((todo) => !todo.categoryId && !todo.completed);
  
    
    if (uncategorizedTodos.length === 0) return null;

    const isCollapsed = collapsedCategories['uncategorized'];

    return (
      <View style={styles.categoryContainer}>
        <TouchableOpacity 
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse('uncategorized')}
        >
          <Text style={styles.categoryTitle}>Other</Text>
          {isCollapsed ? (
            <ChevronUp size={20} color="#666" />
          ) : (
            <ChevronDown size={20} color="#666" />
          )}
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: '#F5F5F5' }]}>
            {uncategorizedTodos.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };
  

  const renderCompletedTodos = (todayTodos: Todo[]) => {
    const completedTodos = todayTodos.filter((todo) => todo.completed);
  
    
    if (completedTodos.length === 0) return null;

    const isCollapsed = collapsedCategories['completed'];

    return (
      <View style={styles.completedSection}>
        <TouchableOpacity 
          style={styles.categoryHeader}
          onPress={() => toggleCategoryCollapse('completed')}
        >
          <Text style={styles.categoryTitle}>COMPLETED</Text>
          {isCollapsed ? (
            <ChevronUp size={20} color="#666" />
          ) : (
            <ChevronDown size={20} color="#666" />
          )}
        </TouchableOpacity>

        {!isCollapsed && (
          <View style={[styles.categoryContent, { backgroundColor: '#F5F5F5' }]}>
            {completedTodos.map(renderTodoItem)}
          </View>
        )}
      </View>
    );
  };

  // Add this new useEffect to handle auth state changes and fetch/save tasks
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Fetch user's tasks and categories when signed in
        const { data: tasksData, error: tasksError } = await supabase
          .from('todos')
          .select('*')
          .eq('user_id', session.user.id);
        
        if (tasksError) {
          console.error('Error fetching tasks:', tasksError);
        } else if (tasksData) {
          setTodos(tasksData.map(task => ({
            ...task,
            date: new Date(task.date),
            repeatEndDate: task.repeat_end_date ? new Date(task.repeat_end_date) : null,
          })));
        }

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', session.user.id);

        if (categoriesError) {
          console.error('Error fetching categories:', categoriesError);
        } else if (categoriesData) {
          setCategories(categoriesData);
        }
      } else if (event === 'SIGNED_OUT') {
        // Clear all local state when user signs out
        setTodos([]);
        setCategories([]);
        setNewTodo('');
        setNewDescription('');
        setSelectedCategoryId('');
        setShowNewCategoryInput(false);
        setNewCategoryName('');
        setNewCategoryColor('#E3F2FD');
        setEditingTodo(null);
        setCollapsedCategories({});
        setCurrentDate(new Date());
        setTaskDate(null);
        setReminderTime(null);
        setSelectedRepeat('none');
        setRepeatEndDate(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add this test function
  const testDatabaseConnection = async () => {
    try {
      // Wait for session to be initialized
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // First, verify the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('🔐 Session status:', {
        hasSession: !!session,
        userEmail: session?.user?.email,
        userId: session?.user?.id,
        error: sessionError?.message
      });

      if (!session?.user) {
        console.log('❌ No active session found. Please sign in first.');
        return;
      }

      // Verify the user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 User status:', {
        isAuthenticated: !!user,
        email: user?.email,
        id: user?.id,
        error: userError?.message
      });

      if (!user) {
        console.log('❌ User not authenticated');
        return;
      }

      console.log('👤 Testing with user:', {
        email: user.email,
        id: user.id
      });

      // Test categories table
      const testCategory = {
        id: 'test-category-' + Date.now(),
        label: 'Test Category',
        color: '#FF0000',
        user_id: user.id
      };

      console.log('📝 Attempting to insert category:', testCategory);

      // Insert test category
      const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .insert(testCategory)
        .select();

      if (categoryError) {
        console.error('❌ Error inserting category:', {
          message: categoryError.message,
          details: categoryError.details,
          hint: categoryError.hint,
          code: categoryError.code
        });
      } else {
        console.log('✅ Successfully inserted test category:', categoryData);
      }

      // Test todos table
      const testTodo = {
        id: 'test-todo-' + Date.now(),
        text: 'Test Todo',
        description: 'This is a test todo',
        completed: false,
        category_id: testCategory.id,
        date: new Date().toISOString(),
        user_id: user.id
      };

      console.log('📝 Attempting to insert todo:', testTodo);

      // Insert test todo
      const { data: todoData, error: todoError } = await supabase
        .from('todos')
        .insert(testTodo)
        .select();

      if (todoError) {
        console.error('❌ Error inserting todo:', {
          message: todoError.message,
          details: todoError.details,
          hint: todoError.hint,
          code: todoError.code
        });
      } else {
        console.log('✅ Successfully inserted test todo:', todoData);
      }

      // Fetch and verify data
      console.log('📋 Fetching categories...');
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);

      if (categoriesError) {
        console.error('❌ Error fetching categories:', {
          message: categoriesError.message,
          details: categoriesError.details,
          hint: categoriesError.hint,
          code: categoriesError.code
        });
      } else {
        console.log('📋 Categories:', categoriesData);
      }

      console.log('📝 Fetching todos...');
      const { data: todosData, error: todosError } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id);

      if (todosError) {
        console.error('❌ Error fetching todos:', {
          message: todosError.message,
          details: todosError.details,
          hint: todosError.hint,
          code: todosError.code
        });
      } else {
        console.log('📝 Todos:', todosData);
      }

    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  };

  // Add this to your useEffect to run the test when the component mounts
  useEffect(() => {
    // Uncomment this line to run the test
     testDatabaseConnection();
  }, []);

  return (

      <View style={{ flex: 1 }}>
        <GestureHandlerRootView style={styles.container}>
          
          {/* Pan Gesture for Swipe Navigation */}
          <PanGestureHandler
            onGestureEvent={({ nativeEvent }) => {
              if (!hasTriggeredSwipeHaptic) {
                if (nativeEvent.translationX > 50 || nativeEvent.translationX < -50) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setHasTriggeredSwipeHaptic(true);
                }
              }
            }}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state === State.END) {
                setHasTriggeredSwipeHaptic(false);
                if (nativeEvent.translationX > 50) {
                  goToPreviousDay();
                } else if (nativeEvent.translationX < -50) {
                  goToNextDay();
                }
              }
            }}
            activeOffsetX={[-20, 20]}
          >
            <View style={{ flex: 1 }}>
              {/* HEADER */}
              <View style={styles.header}>
                <TouchableOpacity style={styles.menuButton}>
                  <MenuIcon size={24} color="#1a1a1a" />
                </TouchableOpacity>
                <Text style={styles.title}>tasks</Text>
              </View>
    
              {/* DATE NAVIGATION */}
              <View style={styles.dateNavigation}>
                <TouchableOpacity style={styles.dateHeader} onPress={goToToday}>
                  {formatDateHeader(currentDate)}
                  {!isSameDay(currentDate, new Date()) && (
                    <Text style={styles.todayText}>Tap to return to today</Text>
                  )}
                </TouchableOpacity>
              </View>
    
              {/* TASK LIST */}
              <ScrollView style={styles.todoList} showsVerticalScrollIndicator={false}>
              {todayTodos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>no tasks!</Text>
                  <Text style={styles.emptyStateSubtitle}>Take a breather :)</Text>
                </View>
              ) : (
                <>
                  {categories.map(category => renderCategory(category, todayTodos))}
                  {renderUncategorizedTodos(todayTodos)}
                  {renderCompletedTodos(todayTodos)}
                </>
              )}
              </ScrollView>
    
              {/* ADD TASK BUTTON */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => {
                  resetForm();                 // (Optional) Clear old input
                  bottomSheetRef.current?.expand(); // ✅ Open the bottomsheet
                }}
              >
                <Plus size={24} color="white" />
              </TouchableOpacity>
            </View>
          </PanGestureHandler>
    
          {/* --- NEW TASK MODAL --- */}
          <BottomSheet
            ref={bottomSheetRef}
            index={-1}
            snapPoints={['90%']}
            enablePanDownToClose
            detached={true}
            bottomInset={0}
            style={styles.bottomSheet} // make sure you have the full width and nice border radius in your styles
            onChange={(index) => {
              if (index === -1) {
                  resetForm();
              }
            }}
          >
           <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

                {/* --- HEADER --- */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Task</Text>
                  <TouchableOpacity onPress={() => bottomSheetRef.current?.close()}>
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* --- TITLE INPUT --- */}
                <TextInput
                  style={styles.input}
                  value={newTodo}
                  onChangeText={setNewTodo}
                  placeholder="What needs to be done?"
                />

                {/* --- DESCRIPTION INPUT --- */}
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Add description (optional)"
                  multiline
                />

                {/* --- CATEGORY SECTION --- */}
                <View style={styles.categorySection}>
                  <Text style={styles.sectionTitle}>Category</Text>

                  {/* Existing Category Buttons + Plus */}
                  <View style={styles.categoryButtons}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryButton,
                          { backgroundColor: category.color },
                          selectedCategoryId === category.id && styles.selectedCategoryButton,
                        ]}
                        onPress={() => {
                          setSelectedCategoryId(category.id);
                          setShowNewCategoryInput(false);
                        }}
                        onLongPress={() => {
                          Alert.alert(
                            "Delete Category",
                            `Are you sure you want to delete "${category.label}"? This will also delete all tasks in this category.`,
                            [
                              {
                                text: "Cancel",
                                style: "cancel"
                              },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => {
                                  // Remove all todos in this category
                                  setTodos(prev => prev.filter(todo => todo.categoryId !== category.id));
                                  // Remove the category
                                  setCategories(prev => prev.filter(c => c.id !== category.id));
                                  // Clear selected category if it was the deleted one
                                  if (selectedCategoryId === category.id) {
                                    setSelectedCategoryId('');
                                  }
                                  // Remove from collapsed state
                                  const newCollapsed = { ...collapsedCategories };
                                  delete newCollapsed[category.id];
                                  setCollapsedCategories(newCollapsed);
                                }
                              }
                            ]
                          );
                        }}
                        delayLongPress={500}
                      >
                        <Text style={styles.categoryButtonText}>
                          {category.label.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {/* Plus Button */}
                    <TouchableOpacity
                      style={styles.newCategoryButton}
                      onPress={() => setShowNewCategoryInput(true)}
                    >
                      <Plus size={20} color="#666" />
                    </TouchableOpacity>
                    {showNewCategoryInput && (
                      <View style={styles.newCategoryForm}>
                        {/* Category Name Input */}
                        <TextInput
                          style={styles.input}
                          value={newCategoryName}
                          onChangeText={setNewCategoryName}
                          placeholder="Category name"
                        />

                        {/* Theme Selector */}
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ marginTop: 12, flexDirection: 'row' }}
                        >
                          {Object.keys(THEMES).map((theme) => (
                            <TouchableOpacity
                              key={theme}
                              style={{
                                paddingVertical: 6,
                                paddingHorizontal: 12,
                                backgroundColor: selectedTheme === theme ? '#007AFF' : '#E0E0E0',
                                borderRadius: 20,
                                marginRight: 10,
                              }}
                              onPress={() => setSelectedTheme(theme as keyof typeof THEMES)}
                            >
                              <Text style={{ color: selectedTheme === theme ? 'white' : '#333', fontWeight: '600' }}>
                                {theme}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        {/* Swatch Grid */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                          {THEMES[selectedTheme].map((color) => (
                            <TouchableOpacity
                              key={color}
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 15,
                                backgroundColor: color,
                                margin: 5,
                                borderWidth: newCategoryColor === color ? 2 : 0,
                                borderColor: '#000',
                              }}
                              onPress={() => setNewCategoryColor(color)}
                            />
                          ))}
                        </View>
                      </View>
                    )}

                  </View>

                </View>


                {/* --- PICK DATE SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Date</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => setShowTaskDatePicker(true)}
                  >
                    <Calendar size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {taskDate ? taskDate.toLocaleDateString() : "Pick a date"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* --- REMINDER SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Reminder</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => setShowReminderPicker(true)}
                  >
                    <Calendar size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* --- REPEAT SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel
                  }>Repeat</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => {
                      repeatBottomSheetRef.current?.expand();
                    }}
                  >
                    <Repeat size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {REPEAT_OPTIONS.find(option => option.value === selectedRepeat)?.label}
                    </Text>
                  </TouchableOpacity>
                </View>


                {/* --- SAVE / CANCEL BUTTONS --- */}
                <View style={{ flexDirection: 'row', marginTop: 24 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      backgroundColor: '#E0E0E0',
                      borderRadius: 12,
                      alignItems: 'center',
                      marginRight: 8,
                    }}
                    onPress={() => bottomSheetRef.current?.close()}
                  >
                    <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      backgroundColor: newTodo.trim() ? '#007AFF' : '#B0BEC5',
                      borderRadius: 12,
                      alignItems: 'center',
                      marginLeft: 8,
                    }}
                    onPress={handleSave}
                    disabled={!newTodo.trim()}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Save</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </KeyboardAvoidingView>
          </BottomSheet>

    
          {/* --- EDIT TASK BOTTOM SHEET --- */}
          <BottomSheet
            ref={editBottomSheetRef}
            index={-1}
            snapPoints={['90%']}
            enablePanDownToClose
            detached={true}
            bottomInset={0}
            style={styles.bottomSheet}
            onChange={(index) => {
              if (index === -1) {
                setEditingTodo(null);
              }
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 120 }} // ✅ give extra space at the bottom
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                
                {/* --- HEADER --- */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Task</Text>
                  <TouchableOpacity onPress={() => editBottomSheetRef.current?.close()}>
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* --- TITLE INPUT --- */}
                <TextInput
                  style={styles.input}
                  value={newTodo}
                  onChangeText={setNewTodo}
                  placeholder="Edit task title"
                />


                {/* --- DESCRIPTION INPUT --- */}
                <TextInput
                  style={[styles.input, styles.descriptionInput]}
                  value={editingTodo?.description || ''}
                  onChangeText={(description) => {
                    if (editingTodo) {
                      setEditingTodo(prev => prev ? { ...prev, description } : null);
                    }
                  }}
                  placeholder="Edit description (optional)"
                  multiline
                />

                {/* --- CATEGORY SECTION --- */}
                <View style={styles.categorySection}>
                  <Text style={styles.sectionTitle}>Category</Text>
                  <View style={styles.categoryButtons}>
                    {categories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryButton,
                          { backgroundColor: category.color },
                          editingTodo?.categoryId === category.id && styles.selectedCategoryButton,
                        ]}
                        onPress={() => {
                          if (editingTodo) {
                            setEditingTodo(prev => prev ? { ...prev, categoryId: category.id } : null);
                          }
                          setShowNewCategoryInput(false);
                        }}
                        onLongPress={() => {
                          Alert.alert(
                            "Delete Category",
                            `Are you sure you want to delete "${category.label}"? This will also delete all tasks in this category.`,
                            [
                              {
                                text: "Cancel",
                                style: "cancel"
                              },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => {
                                  // Remove all todos in this category
                                  setTodos(prev => prev.filter(todo => todo.categoryId !== category.id));
                                  // Remove the category
                                  setCategories(prev => prev.filter(c => c.id !== category.id));
                                  // Clear selected category if it was the deleted one
                                  if (editingTodo?.categoryId === category.id) {
                                    setEditingTodo(prev => prev ? { ...prev, categoryId: '' } : null);
                                  }
                                  // Remove from collapsed state
                                  const newCollapsed = { ...collapsedCategories };
                                  delete newCollapsed[category.id];
                                  setCollapsedCategories(newCollapsed);
                                }
                              }
                            ]
                          );
                        }}
                        delayLongPress={500}
                      >
                        <Text style={styles.categoryButtonText}>{category.label}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.newCategoryButton}
                      onPress={() => setShowNewCategoryInput(true)}
                    >
                      <Plus size={20} color="#666" />
                    </TouchableOpacity>
                  </View>

                  {/* --- NEW CATEGORY INPUT --- */}
                  {showNewCategoryInput && (
                    <View style={styles.newCategoryForm}>
                      {/* Category Name Input */}
                      <TextInput
                        style={styles.input}
                        value={newCategoryName}
                        onChangeText={setNewCategoryName}
                        placeholder="Category name"
                      />

                      {/* Theme Selector */}
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ marginTop: 12, flexDirection: 'row' }}
                      >
                        {Object.keys(THEMES).map((theme) => (
                          <TouchableOpacity
                            key={theme}
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              backgroundColor: selectedTheme === theme ? '#007AFF' : '#E0E0E0',
                              borderRadius: 20,
                              marginRight: 10,
                            }}
                            onPress={() => setSelectedTheme(theme as keyof typeof THEMES)}
                          >
                            <Text style={{ color: selectedTheme === theme ? 'white' : '#333', fontWeight: '600' }}>
                              {theme}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Swatch Grid */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                        {THEMES[selectedTheme].map((color) => (
                          <TouchableOpacity
                            key={color}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 15,
                              backgroundColor: color,
                              margin: 5,
                              borderWidth: newCategoryColor === color ? 2 : 0,
                              borderColor: '#000',
                            }}
                            onPress={() => setNewCategoryColor(color)}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                </View>

                {/* --- PICK DATE SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Date</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => setShowTaskDatePicker(true)}
                  >
                    <Calendar size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {taskDate ? taskDate.toLocaleDateString() : "Pick a date"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* --- REMINDER SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Reminder</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => setShowReminderPicker(true)}
                  >
                    <Calendar size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {reminderTime ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* --- REPEAT SECTION --- */}
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>Repeat</Text>
                  <TouchableOpacity
                    style={styles.newOptionButton}
                    onPress={() => {
                      repeatBottomSheetRef.current?.expand(); // ✅ Open on top
                    }}
                    
                  >
                    <Repeat size={20} color="#666" />
                    <Text style={styles.newOptionText}>
                      {REPEAT_OPTIONS.find(option => option.value === selectedRepeat)?.label}
                    </Text>
                  </TouchableOpacity>
                </View>


                {/* --- SAVE / CANCEL BUTTONS --- */}
                <View style={{ flexDirection: 'row', marginTop: 24 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      backgroundColor: '#E0E0E0',
                      borderRadius: 12,
                      alignItems: 'center',
                      marginRight: 8,
                    }}
                    onPress={() => editBottomSheetRef.current?.close()}
                  >
                    <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      backgroundColor: editingTodo?.text?.trim() ? '#007AFF' : '#B0BEC5',
                      borderRadius: 12,
                      alignItems: 'center',
                      marginLeft: 8,
                    }}
                    onPress={handleEditSave}
                    disabled={!editingTodo?.text?.trim()}
                  >
                    <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Save Changes</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </KeyboardAvoidingView>
          </BottomSheet>

          {/* --- REPEAT OPTIONS MODAL (Separate) --- */}
          <BottomSheet
            ref={repeatBottomSheetRef}
            index={-1}
            snapPoints={['65%']}
            enablePanDownToClose
            detached
            bottomInset={0}
            style={styles.bottomSheet}
            onChange={(index) => {
              if (index === -1) {
                setShowRepeatOptions(false);
              }
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
                keyboardShouldPersistTaps="handled"
              >
                {/* --- Repeat Options Header --- */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Repeat</Text>
                  <TouchableOpacity onPress={() => repeatBottomSheetRef.current?.close()}>
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                {/* --- Repeat Options List --- */}
                {REPEAT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.repeatOption,
                      selectedRepeat === option.value && styles.selectedRepeatOption,
                    ]}
                    onPress={() => {
                      setSelectedRepeat(option.value);
                    }}
                  >
                    <Text
                      style={[
                        styles.repeatOptionText,
                        selectedRepeat === option.value && styles.selectedRepeatOptionText,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <>
                {/* --- Custom Repeat --- */}
                  {selectedRepeat === 'custom' && renderCustomRepeatSection()}

                  {selectedRepeat !== 'none' && (
                    <View style={{ marginTop: 20 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>
                        End On
                      </Text>

                      <TouchableOpacity
                        style={[styles.optionButton]}
                        onPress={() => setShowEndDatePicker(true)}
                      >
                        <Calendar size={20} color="#666" />
                        <Text style={styles.optionText}>
                          {repeatEndDate ? repeatEndDate.toLocaleDateString() : "Pick end date"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* 🧠 Always show these buttons no matter what */}
                  <View style={{ flexDirection: 'row', marginTop: 24 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        backgroundColor: '#E0E0E0',
                        borderRadius: 12,
                        alignItems: 'center',
                        marginRight: 8,
                      }}
                      onPress={() => {
                        setSelectedRepeat('none');
                        setRepeatEndDate(null);
                        repeatBottomSheetRef.current?.close();
                      }}
                    >
                      <Text style={{ color: '#333', fontWeight: '600', fontSize: 16 }}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 14,
                        backgroundColor: '#007AFF',
                        borderRadius: 12,
                        alignItems: 'center',
                        marginLeft: 8,
                      }}
                      onPress={() => {
                        repeatBottomSheetRef.current?.close();
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>

              </ScrollView>
            </KeyboardAvoidingView>
          </BottomSheet>

          <DateTimePickerModal
            isVisible={showReminderPicker}
            mode="time"  // 🔥 ONLY time
            onConfirm={(date) => {
              setReminderTime(date);
              setShowReminderPicker(false);
            }}
            onCancel={() => setShowReminderPicker(false)}
          />

          <DateTimePickerModal
            isVisible={showTaskDatePicker}
            mode="date"   // 📅 Only date
            onConfirm={(date) => {
              setTaskDate(date);
              setShowTaskDatePicker(false);
            }}
            onCancel={() => setShowTaskDatePicker(false)}
          />

          <DateTimePickerModal
            isVisible={showEndDatePicker}
            mode="date"
            onConfirm={(date) => {
              setRepeatEndDate(date);
              setShowEndDatePicker(false);
            }}
            onCancel={() => setShowEndDatePicker(false)}
          />
        </GestureHandlerRootView>
      </View>
    );
}  
