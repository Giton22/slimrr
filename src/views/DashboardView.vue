<script setup lang="ts">
import { ref } from 'vue'
import { Swiper, SwiperSlide } from 'swiper/vue'
import { A11y } from 'swiper/modules'
import type { Swiper as SwiperInstance } from 'swiper'
import WeightSection from '@/components/dashboard/WeightSection.vue'
import KcalSection from '@/components/dashboard/KcalSection.vue'

import 'swiper/css'

const activeIndex = ref(0)
const swiperInstance = ref<SwiperInstance | null>(null)

function onSwiper(swiper: SwiperInstance) {
  swiperInstance.value = swiper
}

function onSlideChange(swiper: SwiperInstance) {
  activeIndex.value = swiper.activeIndex
}

function goToSlide(index: number) {
  swiperInstance.value?.slideTo(index)
}
</script>

<template>
  <!-- Mobile: swipeable slides (hidden on lg+) -->
  <div class="lg:hidden">
    <Swiper
      :modules="[A11y]"
      :slides-per-view="1"
      :space-between="0"
      class="dashboard-swiper"
      @swiper="onSwiper"
      @slide-change="onSlideChange"
    >
      <SwiperSlide>
        <div class="px-4 pb-16 pt-6 sm:px-6">
          <WeightSection />
        </div>
      </SwiperSlide>
      <SwiperSlide>
        <div class="px-4 pb-16 pt-6 sm:px-6">
          <KcalSection />
        </div>
      </SwiperSlide>
    </Swiper>

    <!-- Fixed dot indicator — always visible at bottom of screen -->
    <div class="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-2 pb-safe py-3 lg:hidden">
      <button
        v-for="(_, i) in 2"
        :key="i"
        class="dashboard-dot"
        :class="{ 'dashboard-dot--active': activeIndex === i }"
        :aria-label="`Go to ${i === 0 ? 'Weight' : 'Calories'} section`"
        @click="goToSlide(i)"
      />
    </div>
  </div>

  <!-- Desktop: side-by-side 50/50 layout (hidden below lg) -->
  <div class="mx-auto hidden max-w-[1600px] gap-6 px-6 py-6 lg:grid lg:grid-cols-2">
    <WeightSection />
    <KcalSection />
  </div>
</template>
